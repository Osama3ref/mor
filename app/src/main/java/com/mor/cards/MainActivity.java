package com.mor.cards;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;

public class MainActivity extends Activity {
    private static LanServer server;
    private static final int REQ_MIC = 7;
    private WebView web;
    private PermissionRequest pendingMic;
    private static final int REQ_FILE = 9;
    private android.webkit.ValueCallback<android.net.Uri[]> fileCb;

    @Override
    protected void onActivityResult(int code, int result, android.content.Intent data) {
        super.onActivityResult(code, result, data);
        if (code != REQ_FILE || fileCb == null) return;
        android.net.Uri u = (result == RESULT_OK && data != null) ? data.getData() : null;
        fileCb.onReceiveValue(u != null ? new android.net.Uri[]{u} : null);
        fileCb = null;
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        startServer();
        web = new WebView(this);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, android.webkit.ValueCallback<android.net.Uri[]> cb, FileChooserParams params) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                android.content.Intent i = new android.content.Intent(android.content.Intent.ACTION_GET_CONTENT);
                i.addCategory(android.content.Intent.CATEGORY_OPENABLE);
                i.setType("image/*");
                try { startActivityForResult(android.content.Intent.createChooser(i, "اختر صورة"), REQ_FILE); }
                catch (Exception e) { fileCb = null; return false; }
                return true;
            }
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean wantsMic = false;
                    for (String r : request.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) wantsMic = true;
                    if (!wantsMic) { request.deny(); return; }
                    if (Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingMic = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
                    }
                });
            }
        });
        web.addJavascriptInterface(new Bridge(), "MorNative");
        setContentView(web);
        initTts();
        if (saved != null) web.restoreState(saved);
        else web.loadUrl("http://127.0.0.1:" + LanServer.PORT + "/");
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code != REQ_MIC || pendingMic == null) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) pendingMic.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        else pendingMic.deny();
        pendingMic = null;
    }

    private void startServer() {
        if (server != null) return;
        final android.content.res.AssetManager assets = getApplicationContext().getAssets();
        server = new LanServer(() -> {
            try (InputStream in = assets.open("index.html")) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                return out.toByteArray();
            }
        });
        try { server.start(); } catch (IOException e) { server = null; }
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    private long lastBack = 0;
    @Override public void onBackPressed() {
        web.evaluateJavascript("(window.__back ? window.__back() : 'exit')", v -> {
            if (v != null && v.contains("ok")) return;
            long now = System.currentTimeMillis();
            if (now - lastBack < 2000) finish();
            else { lastBack = now; android.widget.Toast.makeText(this, "اكبس رجوع كمان مرة للخروج", android.widget.Toast.LENGTH_SHORT).show(); }
        });
    }

    private android.speech.tts.TextToSpeech tts;
    private boolean ttsReady = false;
    private void initTts() {
        if (tts != null) return;
        tts = new android.speech.tts.TextToSpeech(getApplicationContext(), st -> {
            if (st != android.speech.tts.TextToSpeech.SUCCESS) return;
            int r = tts.setLanguage(new java.util.Locale("ar"));
            ttsReady = r != android.speech.tts.TextToSpeech.LANG_MISSING_DATA && r != android.speech.tts.TextToSpeech.LANG_NOT_SUPPORTED;
            tts.setSpeechRate(0.9f);
        });
    }
    @Override protected void onDestroy() { if (tts != null) tts.shutdown(); super.onDestroy(); }

    class Bridge {
        @JavascriptInterface
        public boolean speak(final String text) {
            runOnUiThread(() -> {
                initTts();
                if (ttsReady) tts.speak(text, android.speech.tts.TextToSpeech.QUEUE_ADD, null, "n" + System.nanoTime());
            });
            return ttsReady;
        }

        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(() -> {
                android.content.Intent i = new android.content.Intent(android.content.Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(android.content.Intent.EXTRA_TEXT, text);
                startActivity(android.content.Intent.createChooser(i, "شارك الدعوة"));
            });
        }

        @JavascriptInterface
        public void setOrientation(final String o) {
            runOnUiThread(() -> setRequestedOrientation("landscape".equals(o)
                    ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
        }

        @JavascriptInterface
        public String getIp() {
            String fallback = "";
            try {
                for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                    if (!ni.isUp() || ni.isLoopback()) continue;
                    for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                        if (!(a instanceof Inet4Address) || !a.isSiteLocalAddress()) continue;
                        String name = ni.getName();
                        if (name.startsWith("wlan") || name.startsWith("ap") || name.startsWith("swlan")) return a.getHostAddress();
                        if (fallback.isEmpty()) fallback = a.getHostAddress();
                    }
                }
            } catch (Exception ignored) { }
            return fallback;
        }
    }
}
