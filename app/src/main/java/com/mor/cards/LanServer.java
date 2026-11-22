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
    private String host = "", phase = "lobby", s = "";
    private long sv = 0;
    private final LinkedHashMap<String, Object[]> players = new LinkedHashMap<>(); // id -> {name, seat}

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
            if (len > 1_000_000) { send(sock, 413, "application/json", "{}".getBytes(StandardCharsets.UTF_8)); return; }
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
        if (!method.equals("POST")) { json(sock, 404, "{\"error\":\"not found\"}"); return; }
        Map<String, Object> b;
        try { Object o = Json.parse(body); if (!(o instanceof Map)) throw new IllegalArgumentException(); b = cast(o); }
        catch (Exception e) { json(sock, 400, "{\"error\":\"bad json\"}"); return; }
        synchronized (lock) {
            switch (path) {
                case "/api/create":
                    host = str(b.get("host")); phase = "lobby"; s = ""; sv = 0; players.clear();
                    break;
                case "/api/player": {
                    String id = str(b.get("id"));
                    int seat = (int) num(b.get("seat"), -1);
                    if (id.isEmpty()) { json(sock, 400, "{\"error\":\"id\"}"); return; }
                    if (seat >= 0) for (Map.Entry<String, Object[]> e : players.entrySet())
                        if (!e.getKey().equals(id) && ((Integer) e.getValue()[1]) == seat) { json(sock, 409, "{\"error\":\"seat\"}"); return; }
                    String name = str(b.get("name"));
                    if (name.length() > 20) name = name.substring(0, 20);
                    players.put(id, new Object[]{name, seat});
                    break;
                }
                case "/api/room": {
                    long expect = (long) num(b.get("expect"), -1);
                    if (expect != sv) { json(sock, 409, "{\"error\":\"conflict\",\"room\":" + roomJson() + "}"); return; }
                    s = str(b.get("s")); phase = str(b.get("phase")); sv = (long) num(b.get("sv"), sv + 1);
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
        return "{\"host\":" + Json.quote(host) + ",\"phase\":" + Json.quote(phase) + ",\"s\":" + Json.quote(s) + ",\"sv\":" + sv + "}";
    }
    private String snapshot() {
        StringBuilder p = new StringBuilder("[");
        for (Map.Entry<String, Object[]> e : players.entrySet()) {
            if (p.length() > 1) p.append(',');
            p.append("{\"id\":").append(Json.quote(e.getKey())).append(",\"name\":").append(Json.quote((String) e.getValue()[0])).append(",\"seat\":").append(e.getValue()[1]).append('}');
        }
        return "{\"rev\":" + rev + ",\"room\":" + roomJson() + ",\"players\":" + p.append(']') + "}";
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
