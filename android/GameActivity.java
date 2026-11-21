package io.github.nikolai1005.sprunkiveritytd;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

public final class GameActivity extends Activity {
    private static final String GAME_HOST = "nikolai1005.github.io";
    private static final String GAME_PATH = "/Sprunki-Verity-TD/";
    private static final String GAME_URL = "https://" + GAME_HOST + GAME_PATH;
    private static final int BACKGROUND = 0xFF170D22;
    private static final long STARTUP_WAIT_MS = 3500;
    private static final String APPLY_UPDATE_WHEN_IDLE =
            "(function(next){"
            + "if(typeof cur!=='string'||(cur!=='menu'&&cur!=='lobby')||typeof VER!=='string')return;"
            + "if((typeof G!=='undefined'&&G&&!G.over)||document.querySelector('#modal:not(.hide),dialog[open]'))return;"
            + "var p=VER.split('.');"
            + "var current=Number(p[0])*1000000+Number(p[1])*1000+Number(p[2]||0);"
            + "if(current<next){if(typeof save==='function')save();location.reload();}"
            + "})(";
    private static final String BACK_IN_GAME =
            "(function(){"
            + "var dialog=document.getElementById('th-welcome');"
            + "if(dialog&&dialog.open){document.getElementById('th-welcome-close').click();return true;}"
            + "var skip=document.querySelector('#ap-scene:not(.hide) #ap-scene-skip');"
            + "if(skip){skip.click();return true;}"
            + "if(document.querySelector('#modal:not(.hide)')&&typeof mClose==='function'){mClose();return true;}"
            + "if(typeof cur!=='string')return false;"
            + "if(cur==='arn'&&typeof arExit==='function'){arExit();return true;}"
            + "var screen=document.getElementById(cur);"
            + "var button=screen&&screen.querySelector('button.bk:not(.hide)');"
            + "if(button&&button.offsetParent){button.click();return true;}"
            + "return false;})()";

    private FrameLayout content;
    private WebView game;
    private TextView opening;
    private GameContent gameContent;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable openGame = this::showGame;
    private boolean started;
    private boolean checking;
    private boolean resumed;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        gameContent = new GameContent(getFilesDir().toPath(), GAME_URL + "index.html", installedVersion());
        content = new FrameLayout(this);
        content.setBackgroundColor(BACKGROUND);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);
        if (Build.VERSION.SDK_INT >= 35) {
            getWindow().setDecorFitsSystemWindows(false);
            content.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            });
        }

        game = new WebView(this);
        game.setBackgroundColor(BACKGROUND);
        game.setOverScrollMode(View.OVER_SCROLL_NEVER);
        game.setKeepScreenOn(true);
        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        game.setWebChromeClient(new WebChromeClient());
        game.setWebViewClient(new GameClient());

        content.addView(game, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        opening = new TextView(this);
        opening.setText("Открываю игру…");
        opening.setTextColor(0xFFFFEBCF);
        opening.setTextSize(16);
        opening.setGravity(Gravity.CENTER);
        content.addView(opening, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(content);
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (checking) return;
        if (!hasInternet()) {
            showGame();
            return;
        }
        checking = true;
        if (!started) main.postDelayed(openGame, STARTUP_WAIT_MS);
        new Thread(() -> {
            long newest;
            try {
                newest = gameContent.refresh();
            } catch (IOException unavailable) {
                Log.d("VerityGame", "Using the available game after the update check", unavailable);
                newest = gameContent.currentVersion();
            }
            long version = newest;
            main.post(() -> checkedVersion(version));
        }, "verity-game-update").start();
    }

    private void checkedVersion(long version) {
        checking = false;
        main.removeCallbacks(openGame);
        if (isDestroyed() || isFinishing()) return;
        if (!started) {
            showGame();
        } else if (resumed) {
            game.evaluateJavascript(APPLY_UPDATE_WHEN_IDLE + version + ")", null);
        }
    }

    private void showGame() {
        if (started || isDestroyed() || isFinishing()) return;
        started = true;
        content.removeView(opening);
        game.loadUrl(GAME_URL);
    }

    private boolean hasInternet() {
        ConnectivityManager manager = getSystemService(ConnectivityManager.class);
        if (manager == null) return true;
        Network network = manager.getActiveNetwork();
        NetworkCapabilities capabilities = network == null ? null : manager.getNetworkCapabilities(network);
        return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    @SuppressWarnings("deprecation")
    private long installedVersion() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
        } catch (PackageManager.NameNotFoundException missingPackage) {
            throw new IllegalStateException("Cannot read the installed game's version", missingPackage);
        }
    }

    private static boolean isGamePage(Uri uri) {
        return "https".equals(uri.getScheme()) && GAME_HOST.equals(uri.getHost())
                && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443)
                && (GAME_PATH.equals(uri.getPath()) || (GAME_PATH + "index.html").equals(uri.getPath()));
    }

    private final class GameClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame() || !isGamePage(request.getUrl())) {
                return super.shouldInterceptRequest(view, request);
            }
            // Both copies use one HTTPS origin, so updates keep the player's WebView storage.
            try {
                InputStream source = gameContent.openDownloaded();
                if (source == null) source = getAssets().open("index.html");
                return new WebResourceResponse("text/html", "UTF-8", 200, "OK",
                        Collections.singletonMap("Cache-Control", "no-store"), source);
            } catch (IOException missingAsset) {
                byte[] message = "Не удалось открыть файлы игры.".getBytes(StandardCharsets.UTF_8);
                return new WebResourceResponse("text/plain", "UTF-8", 500, "Game file unavailable",
                        Collections.emptyMap(), new ByteArrayInputStream(message));
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!request.isForMainFrame() || isGamePage(uri)) {
                return false;
            }
            if (request.hasGesture() && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException noBrowser) {
                    // The device may not have a browser registered for this URL.
                }
            }
            return true;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (!started) {
            moveTaskToBack(true);
            return;
        }
        game.evaluateJavascript(BACK_IN_GAME, result -> {
            if (!"true".equals(result) && !isFinishing()) {
                moveTaskToBack(true);
            }
        });
    }

    @Override
    protected void onPause() {
        resumed = false;
        game.onPause();
        game.pauseTimers();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        game.resumeTimers();
        game.onResume();
    }

    @Override
    protected void onDestroy() {
        main.removeCallbacks(openGame);
        content.removeView(game);
        game.destroy();
        super.onDestroy();
    }
}
