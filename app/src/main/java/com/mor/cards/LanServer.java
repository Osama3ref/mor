package com.mor.cards;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** Tiny HTTP server that hosts one Mor room on the local network. No Android dependencies. */
public class LanServer {
    public interface PageSource { byte[] page() throws IOException; }

    public static final int PORT = 8765;
    private final PageSource source;
    private final Object lock = new Object();
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private ServerSocket server;

    // room state
    private long rev = 0;
    private String host = "", phase = "lobby", s = "", game = "mor"; private long timer = 0;
    private long sv = 0;
    private final LinkedHashMap<String, Object[]> players = new LinkedHashMap<>(); // id -> {name, seat}
    private final ArrayList<String> chat = new ArrayList<>();            // JSON objects, newest last
    private final LinkedHashMap<Long, String[]> voices = new LinkedHashMap<>(); // mid -> {mime, base64}
    private long nextMid = 1;
    private final HashSet<String> inVoice = new HashSet<>();
    private final ArrayList<Object[]> signals = new ArrayList<>(); // {seq, to, json}
    private final HashMap<String, Long> sigSeq = new HashMap<>();
    private long nextSig = 1;

    public LanServer(PageSource source) { this.source = source; }

    public synchronized void start() throws IOException {
        if (server != null) return;
        server = new ServerSocket();
        server.setReuseAddress(true);
        server.bind(new InetSocketAddress(PORT));
        Thread t = new Thread(() -> {
            while (!server.isClosed()) {
                try { Socket c = server.accept(); pool.execute(() -> handle(c)); }
                catch (IOException e) { /* closed */ }
            }
        }, "mor-lan");
        t.setDaemon(true);
        t.start();
    }

    private void handle(Socket c) {
        try (Socket sock = c) {
            sock.setSoTimeout(30000);
            InputStream in = new BufferedInputStream(sock.getInputStream());
            String line = readLine(in);
            if (line == null || line.isEmpty()) return;
            String[] parts = line.split(" ");
            String method = parts[0], target = parts.length > 1 ? parts[1] : "/";
            int len = 0;
            for (String h; (h = readLine(in)) != null && !h.isEmpty(); ) {
                int i = h.indexOf(':');
                if (i > 0 && h.substring(0, i).trim().equalsIgnoreCase("content-length")) len = Integer.parseInt(h.substring(i + 1).trim());
            }
            if (len > 3_000_000) { send(sock, 413, "application/json", "{}".getBytes(StandardCharsets.UTF_8)); return; }
            byte[] body = new byte[len];
            for (int r = 0; r < len; ) { int n = in.read(body, r, len - r); if (n < 0) break; r += n; }
            String path = target, query = "";
            int q = target.indexOf('?');
            if (q >= 0) { path = target.substring(0, q); query = target.substring(q + 1); }
            route(sock, method, path, query, new String(body, StandardCharsets.UTF_8));
        } catch (Exception e) { /* drop connection */ }
    }

    private void route(Socket sock, String method, String path, String query, String body) throws IOException {
        if (method.equals("OPTIONS")) { send(sock, 204, "text/plain", new byte[0]); return; }
        if (method.equals("GET") && (path.equals("/") || path.equals("/index.html"))) {
            send(sock, 200, "text/html; charset=utf-8", source.page()); return;
        }
        if (method.equals("GET") && path.equals("/api/poll")) {
            long want = -1;
            for (String kv : query.split("&")) if (kv.startsWith("rev=")) try { want = Long.parseLong(kv.substring(4)); } catch (NumberFormatException ignored) {}
            String out;
            synchronized (lock) {
                long until = System.currentTimeMillis() + 20000;
                while (want == rev && System.currentTimeMillis() < until) {
                    try { lock.wait(Math.max(1, until - System.currentTimeMillis())); } catch (InterruptedException e) { break; }
                }
                out = snapshot();
            }
            json(sock, 200, out); return;
        }
        if (method.equals("GET") && path.equals("/api/voice")) {
            long mid = -1;
            for (String kv : query.split("&")) if (kv.startsWith("mid=")) try { mid = Long.parseLong(kv.substring(4)); } catch (NumberFormatException ignored) {}
            String[] v;
            synchronized (lock) { v = voices.get(mid); }
            if (v == null) { json(sock, 404, "{\"error\":\"gone\"}"); return; }
            json(sock, 200, "{\"mime\":" + Json.quote(v[0]) + ",\"data\":" + Json.quote(v[1]) + "}"); return;
        }
        if (method.equals("GET") && path.equals("/api/signals")) {
            String to = ""; long after = 0;
            for (String kv : query.split("&")) {
                if (kv.startsWith("to=")) to = URLDecoder.decode(kv.substring(3), "UTF-8");
                if (kv.startsWith("after=")) try { after = Long.parseLong(kv.substring(6)); } catch (NumberFormatException ignored) {}
            }
            StringBuilder o = new StringBuilder("[");
            synchronized (lock) {
                for (Object[] sg : signals) if (to.equals(sg[1]) && (Long) sg[0] > after) {
                    if (o.length() > 1) o.append(',');
                    o.append("{\"seq\":").append(sg[0]).append(",\"msg\":").append((String) sg[2]).append('}');
                }
            }
            json(sock, 200, o.append(']').toString()); return;
        }
        if (!method.equals("POST")) { json(sock, 404, "{\"error\":\"not found\"}"); return; }
        Map<String, Object> b;
        try { Object o = Json.parse(body); if (!(o instanceof Map)) throw new IllegalArgumentException(); b = cast(o); }
        catch (Exception e) { json(sock, 400, "{\"error\":\"bad json\"}"); return; }
        synchronized (lock) {
            switch (path) {
                case "/api/create":
                    host = str(b.get("host")); game = str(b.get("game")); if (game.isEmpty()) game = "mor"; phase = "lobby"; s = ""; sv = 0; timer = 0; players.clear(); chat.clear(); voices.clear();
                    inVoice.clear(); signals.clear(); sigSeq.clear();
                    break;
                case "/api/player": {
                    String id = str(b.get("id"));
                    int seat = (int) num(b.get("seat"), -1);
                    if (id.isEmpty()) { json(sock, 400, "{\"error\":\"id\"}"); return; }
                    if (seat >= 0) for (Map.Entry<String, Object[]> e : players.entrySet())
                        if (!e.getKey().equals(id) && ((Integer) e.getValue()[1]) == seat) { json(sock, 409, "{\"error\":\"seat\"}"); return; }
                    String name = str(b.get("name"));
                    if (name.length() > 20) name = name.substring(0, 20);
                    String av = str(b.get("av"));
                    if (av.length() > 40) av = av.substring(0, 40);
                    String ph = str(b.get("ph"));
                    if (ph.length() > 30000 || !(ph.isEmpty() || ph.startsWith("data:image/"))) ph = "";
                    players.put(id, new Object[]{name, seat, av, ph});
                    break;
                }
                case "/api/room": {
                    long expect = (long) num(b.get("expect"), -1);
                    if (expect != sv) { json(sock, 409, "{\"error\":\"conflict\",\"room\":" + roomJson() + "}"); return; }
                    s = str(b.get("s")); phase = str(b.get("phase")); sv = (long) num(b.get("sv"), sv + 1);
                    break;
                }
                case "/api/meta": {
                    String g = str(b.get("game")); if (!g.isEmpty()) game = g;
                    String ph = str(b.get("phase")); if (!ph.isEmpty()) phase = ph;
                    if (b.containsKey("timer")) timer = (long) num(b.get("timer"), timer);
                    break;
                }
                case "/api/leave": {
                    players.remove(str(b.get("id"))); inVoice.remove(str(b.get("id")));
                    break;
                }
                case "/api/voicestate": {
                    String id = str(b.get("id"));
                    if (Boolean.TRUE.equals(b.get("on"))) inVoice.add(id); else inVoice.remove(id);
                    break;
                }
                case "/api/signal": {
                    String to = str(b.get("to"));
                    String msg = Json.write(b);
                    if (msg.length() > 60000) { json(sock, 413, "{}"); return; }
                    long seq = nextSig++;
                    signals.add(new Object[]{seq, to, msg});
                    while (signals.size() > 200) signals.remove(0);
                    sigSeq.put(to, seq);
                    break;
                }
                case "/api/chat":
                case "/api/voice": {
                    boolean audio = path.equals("/api/voice");
                    String text = str(b.get("text"));
                    if (text.length() > 300) text = text.substring(0, 300);
                    String data = str(b.get("data"));
                    if (audio && (data.isEmpty() || data.length() > 2_500_000)) { json(sock, 400, "{\"error\":\"audio\"}"); return; }
                    if (!audio && text.trim().isEmpty()) { json(sock, 400, "{\"error\":\"empty\"}"); return; }
                    long mid = nextMid++;
                    if (audio) {
                        voices.put(mid, new String[]{str(b.get("mime")), data});
                        while (voices.size() > 20) voices.remove(voices.keySet().iterator().next());
                    }
                    String name = str(b.get("name"));
                    if (name.length() > 20) name = name.substring(0, 20);
                    chat.add("{\"mid\":" + mid + ",\"id\":" + Json.quote(str(b.get("id"))) + ",\"name\":" + Json.quote(name)
                            + ",\"text\":" + Json.quote(text) + ",\"audio\":" + audio + ",\"t\":" + System.currentTimeMillis() + "}");
                    while (chat.size() > 40) chat.remove(0);
                    break;
                }
                default: json(sock, 404, "{\"error\":\"not found\"}"); return;
            }
            rev++;
            lock.notifyAll();
            json(sock, 200, "{\"ok\":true,\"rev\":" + rev + "}");
        }
    }

    private String roomJson() {
        return "{\"host\":" + Json.quote(host) + ",\"game\":" + Json.quote(game) + ",\"phase\":" + Json.quote(phase) + ",\"s\":" + Json.quote(s) + ",\"sv\":" + sv + ",\"timer\":" + timer + "}";
    }
    private String snapshot() {
        StringBuilder p = new StringBuilder("[");
        for (Map.Entry<String, Object[]> e : players.entrySet()) {
            if (p.length() > 1) p.append(',');
            p.append("{\"id\":").append(Json.quote(e.getKey())).append(",\"name\":").append(Json.quote((String) e.getValue()[0])).append(",\"seat\":").append(e.getValue()[1]).append(",\"av\":").append(Json.quote(e.getValue().length > 2 ? (String) e.getValue()[2] : "")).append(",\"ph\":").append(Json.quote(e.getValue().length > 3 ? (String) e.getValue()[3] : "")).append('}');
        }
        StringBuilder v = new StringBuilder("[");
        for (String id : inVoice) { if (v.length() > 1) v.append(','); v.append(Json.quote(id)); }
        StringBuilder sq = new StringBuilder("{");
        for (Map.Entry<String, Long> e : sigSeq.entrySet()) { if (sq.length() > 1) sq.append(','); sq.append(Json.quote(e.getKey())).append(':').append(e.getValue()); }
        return "{\"rev\":" + rev + ",\"room\":" + roomJson() + ",\"players\":" + p.append(']') + ",\"chat\":[" + String.join(",", chat) + "],\"voice\":" + v.append(']') + ",\"sig\":" + sq.append('}') + "}";
    }

    @SuppressWarnings("unchecked") private static Map<String, Object> cast(Object o) { return (Map<String, Object>) o; }
    private static String str(Object o) { return o instanceof String ? (String) o : ""; }
    private static double num(Object o, double d) { return o instanceof Double ? (Double) o : d; }

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) { if (c == '\n') break; if (c != '\r') b.write(c); if (b.size() > 8192) break; }
        if (c == -1 && b.size() == 0) return null;
        return b.toString("UTF-8");
    }
    private static void json(Socket s, int code, String body) throws IOException { send(s, code, "application/json; charset=utf-8", body.getBytes(StandardCharsets.UTF_8)); }
    private static void send(Socket s, int code, String type, byte[] body) throws IOException {
        String head = "HTTP/1.1 " + code + " X\r\nContent-Type: " + type + "\r\nContent-Length: " + body.length
                + "\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Content-Type\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS"
                + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
        OutputStream out = s.getOutputStream();
        out.write(head.getBytes(StandardCharsets.UTF_8));
        out.write(body);
        out.flush();
    }

    /** Minimal JSON reader/writer (objects, arrays, strings, numbers, booleans, null). */
    static final class Json {
        private final String t; private int i;
        private Json(String t) { this.t = t; }
        static Object parse(String t) { Json j = new Json(t); Object v = j.value(); j.ws(); if (j.i != t.length()) throw new IllegalArgumentException("trailing"); return v; }
        private void ws() { while (i < t.length() && Character.isWhitespace(t.charAt(i))) i++; }
        private Object value() {
            ws();
            if (i >= t.length()) throw new IllegalArgumentException("eof");
            char c = t.charAt(i);
            if (c == '{') {
                i++; Map<String, Object> m = new LinkedHashMap<>(); ws();
                if (t.charAt(i) == '}') { i++; return m; }
                while (true) { ws(); String k = string(); ws(); expect(':'); m.put(k, value()); ws(); if (t.charAt(i) == ',') { i++; continue; } expect('}'); return m; }
            }
            if (c == '[') {
                i++; List<Object> l = new ArrayList<>(); ws();
                if (t.charAt(i) == ']') { i++; return l; }
                while (true) { l.add(value()); ws(); if (t.charAt(i) == ',') { i++; continue; } expect(']'); return l; }
            }
            if (c == '"') return string();
            if (t.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (t.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (t.startsWith("null", i)) { i += 4; return null; }
            int st = i;
            while (i < t.length() && "+-0123456789.eE".indexOf(t.charAt(i)) >= 0) i++;
            return Double.parseDouble(t.substring(st, i));
        }
        private void expect(char c) { if (t.charAt(i) != c) throw new IllegalArgumentException("expected " + c); i++; }
        private String string() {
            expect('"'); StringBuilder b = new StringBuilder();
            while (true) {
                char c = t.charAt(i++);
                if (c == '"') return b.toString();
                if (c != '\\') { b.append(c); continue; }
                char e = t.charAt(i++);
                switch (e) {
                    case 'n': b.append('\n'); break; case 't': b.append('\t'); break; case 'r': b.append('\r'); break;
                    case 'b': b.append('\b'); break; case 'f': b.append('\f'); break;
                    case 'u': b.append((char) Integer.parseInt(t.substring(i, i + 4), 16)); i += 4; break;
                    default: b.append(e);
                }
            }
        }
        @SuppressWarnings("unchecked")
        static String write(Object o) {
            if (o == null) return "null";
            if (o instanceof String) return quote((String) o);
            if (o instanceof Boolean) return o.toString();
            if (o instanceof Double) { double d = (Double) o; return d == Math.rint(d) && Math.abs(d) < 1e15 ? Long.toString((long) d) : Double.toString(d); }
            if (o instanceof Map) {
                StringBuilder b = new StringBuilder("{");
                for (Map.Entry<String, Object> e : ((Map<String, Object>) o).entrySet()) { if (b.length() > 1) b.append(','); b.append(quote(e.getKey())).append(':').append(write(e.getValue())); }
                return b.append('}').toString();
            }
            if (o instanceof List) {
                StringBuilder b = new StringBuilder("[");
                for (Object x : (List<Object>) o) { if (b.length() > 1) b.append(','); b.append(write(x)); }
                return b.append(']').toString();
            }
            return quote(o.toString());
        }
        static String quote(String s) {
            StringBuilder b = new StringBuilder("\"");
            for (int k = 0; k < s.length(); k++) {
                char c = s.charAt(k);
                if (c == '"' || c == '\\') b.append('\\').append(c);
                else if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                else b.append(c);
            }
            return b.append('"').toString();
        }
    }
}
