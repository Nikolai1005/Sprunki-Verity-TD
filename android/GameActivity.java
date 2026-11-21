package io.github.nikolai1005.sprunkiveritytd;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

public final class GameActivity extends Activity {
    private static final String GAME_HOST = "nikolai1005.github.io";
    private static final String GAME_PATH = "/Sprunki-Verity-TD/";
    private static final String GAME_URL = "https://" + GAME_HOST + GAME_PATH;
    private static final int BACKGROUND = 0xFF170D22;
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

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
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
        setContentView(content);
        game.loadUrl(GAME_URL);
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
            // The bundled document keeps an HTTPS origin for Web Crypto and the existing Firebase endpoints.
            try {
                return new WebResourceResponse("text/html", "UTF-8", 200, "OK",
                        Collections.singletonMap("Cache-Control", "no-store"), getAssets().open("index.html"));
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
        game.evaluateJavascript(BACK_IN_GAME, result -> {
            if (!"true".equals(result) && !isFinishing()) {
                moveTaskToBack(true);
            }
        });
    }

    @Override
    protected void onPause() {
        game.onPause();
        game.pauseTimers();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        game.resumeTimers();
        game.onResume();
    }

    @Override
    protected void onDestroy() {
        content.removeView(game);
        game.destroy();
        super.onDestroy();
    }
}
