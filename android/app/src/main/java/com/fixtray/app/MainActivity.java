package com.fixtray.app;

import android.content.res.AssetFileDescriptor;
import android.graphics.Color;
import android.graphics.SurfaceTexture;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.view.Gravity;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private boolean introVisible = false;
    private FrameLayout introLayer;
    private TextureView introTexture;
    private MediaPlayer introPlayer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Set the native-app cookie BEFORE super.onCreate loads the first URL.
        // Vercel's server reads this cookie to server-render the mobile shell
        // from byte 1 — no flash, no client-side detection needed.
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setCookie("https://fixtray.app", "x-fixtray-native=android; Path=/; SameSite=Lax");
        cookieManager.flush();

        super.onCreate(savedInstanceState);

        // System bars sit above WebView, not overlapping
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        // -- Configure WebView immediately --
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            // No bounce/glow when overscrolling
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);

            WebSettings ws = webView.getSettings();
            // MUST be true so the viewport meta tag is respected
            ws.setUseWideViewPort(true);
            // Don't zoom out to show the whole page
            ws.setLoadWithOverviewMode(false);
        }

        // -- Handle back button: go back in WebView history if possible --
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (introVisible) {
                    dismissIntro();
                    return;
                }
                WebView wv = getBridge().getWebView();
                if (wv != null && wv.canGoBack()) {
                    wv.goBack();
                } else {
                    // Let the system handle it (exit app)
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        // -- Inject CSS on every page load via Capacitor's proper API --
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                String url = webView.getUrl();
                if (url != null && url.contains("fixtray.app")) {
                    injectViewportCSS(webView);
                }
                if (!introVisible) paintSystemBars(false);
            }
        });

        showIntro();
    }

    @Override
    public void onDestroy() {
        dismissIntro();
        super.onDestroy();
    }

    /** Bundled logo intro on white. Tap, the end, or a load error reveals login. */
    private void showIntro() {
        WebView webView = getBridge().getWebView();
        if (webView == null || !(webView.getParent() instanceof ViewGroup)) return;

        introVisible = true;
        paintSystemBars(true);

        View.OnClickListener skip = v -> dismissIntro();
        introLayer = new FrameLayout(this);
        introLayer.setBackgroundColor(Color.WHITE);
        introLayer.setOnClickListener(skip);

        ImageView mark = new ImageView(this);
        mark.setImageResource(R.drawable.splash);
        mark.setScaleType(ImageView.ScaleType.FIT_CENTER);
        mark.setBackgroundColor(Color.WHITE);
        mark.setOnClickListener(skip);
        introLayer.addView(mark, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
            Gravity.CENTER));

        introTexture = new TextureView(this);
        introTexture.setOpaque(false);
        introTexture.setOnClickListener(skip);
        introLayer.addView(introTexture, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
            Gravity.CENTER));

        ((ViewGroup) webView.getParent()).addView(introLayer, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT));

        introLayer.postDelayed(() -> {
            if (!introVisible) return;
            try {
                if (introPlayer != null && introPlayer.isPlaying()) return;
                int duration = introPlayer != null ? introPlayer.getDuration() : 0;
                int position = introPlayer != null ? introPlayer.getCurrentPosition() : 0;
                if (duration > 0 && position > 200 && position < duration - 150) return;
            } catch (Exception ignored) {}
            dismissIntro();
        }, 8000);

        introTexture.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
                startIntroPlayer(surface, mark);
            }

            @Override
            public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width, int height) {}

            @Override
            public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
                releaseIntroPlayer();
                return true;
            }

            @Override
            public void onSurfaceTextureUpdated(SurfaceTexture surface) {}
        });
    }

    private void startIntroPlayer(SurfaceTexture surface, ImageView mark) {
        if (!introVisible) return;
        try {
            MediaPlayer player = new MediaPlayer();
            introPlayer = player;
            AssetFileDescriptor afd = getResources().openRawResourceFd(R.raw.intro);
            if (afd == null) {
                dismissIntro();
                return;
            }
            player.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            player.setSurface(new Surface(surface));
            player.setVolume(0f, 0f);
            player.setOnPreparedListener(mp -> {
                if (!introVisible) return;
                fitIntroVideo(mp.getVideoWidth(), mp.getVideoHeight());
                mp.start();
            });
            player.setOnInfoListener((mp, what, extra) -> {
                if (what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START) {
                    mark.setVisibility(View.GONE);
                }
                return false;
            });
            player.setOnCompletionListener(mp -> dismissIntro());
            player.setOnErrorListener((mp, what, extra) -> {
                dismissIntro();
                return true;
            });
            player.prepareAsync();
        } catch (Exception ignored) {
            dismissIntro();
        }
    }

    private void fitIntroVideo(int videoWidth, int videoHeight) {
        if (introLayer == null || introTexture == null || videoWidth <= 0 || videoHeight <= 0) return;
        int pw = introLayer.getWidth();
        int ph = introLayer.getHeight();
        if (pw <= 0 || ph <= 0) {
            introLayer.post(() -> fitIntroVideo(videoWidth, videoHeight));
            return;
        }
        float scale = Math.min(pw / (float) videoWidth, ph / (float) videoHeight);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
            Math.max(1, Math.round(videoWidth * scale)),
            Math.max(1, Math.round(videoHeight * scale)),
            Gravity.CENTER);
        introTexture.setLayoutParams(lp);
    }

    private void dismissIntro() {
        if (!introVisible && introLayer == null) return;
        introVisible = false;
        releaseIntroPlayer();
        if (introLayer != null) {
            if (introLayer.getParent() instanceof ViewGroup) {
                ((ViewGroup) introLayer.getParent()).removeView(introLayer);
            }
            introLayer = null;
        }
        introTexture = null;
        paintSystemBars(false);
    }

    private void releaseIntroPlayer() {
        MediaPlayer player = introPlayer;
        introPlayer = null;
        if (player == null) return;
        try {
            player.setOnCompletionListener(null);
            player.setOnErrorListener(null);
            player.setOnPreparedListener(null);
            player.release();
        } catch (Exception ignored) {}
    }

    private void paintSystemBars(boolean light) {
        runOnUiThread(() -> {
            int color = light ? 0xFFFFFFFF : 0xFF020608;
            getWindow().setStatusBarColor(color);
            getWindow().setNavigationBarColor(color);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (controller != null) {
                controller.setAppearanceLightStatusBars(light);
                controller.setAppearanceLightNavigationBars(light);
            }
        });
    }

    private void injectViewportCSS(WebView webView) {
        // 1. Inject a <style> tag with broad CSS overrides
        String css =
            "*{box-sizing:border-box!important}" +
            "html,body{width:100%!important;max-width:100vw!important;overflow-x:hidden!important;margin:0!important}" +
            "body{min-height:100dvh!important;overflow-y:auto!important;" +
              "padding:env(safe-area-inset-top,28px) 0 0 0!important}" +
            // Login page
            ".sos-content{grid-template-columns:1fr!important}" +
            ".sos-pane+.sos-pane{border-left:none!important;border-top:1px solid rgba(255,255,255,0.08)!important}" +
            ".sos-card{width:100%!important;max-width:100%!important;border-radius:0!important}" +
            ".sos-wrap{padding:env(safe-area-inset-top,28px) 0 0 0!important}" +
            ".sos-header{padding:12px 16px!important}" +
            ".sos-pane{padding:16px!important}" +
            ".sos-title{font-size:18px!important}" +
            ".sos-tabs{width:100%!important}.sos-tab{flex:1!important;text-align:center!important}" +
            ".sos-footer{flex-direction:column!important;padding:16px!important}" +
            // Nav - push down below status bar
            "nav{max-width:100vw!important;overflow:hidden!important}" +
            // Media elements
            "img,video,canvas,iframe,table,pre,svg{max-width:100%!important}";

        // 2. JS that also walks the DOM and fixes inline styles
        String js =
            "(function(){" +
              // Remove previous
              "var old=document.getElementById('cap-vp-fix');if(old)old.remove();" +
              // Inject style tag
              "var s=document.createElement('style');s.id='cap-vp-fix';" +
              "s.textContent='" + css + "';" +
              "document.head.appendChild(s);" +
              // Fix viewport meta
              "var m=document.querySelector('meta[name=viewport]');" +
              "if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}" +
              "m.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';" +
              // Walk all elements and fix inline styles that cause overflow
              "var vw=window.innerWidth;" +
              "document.querySelectorAll('*').forEach(function(el){" +
                "var st=el.style;" +
                // Fix any maxWidth > viewport
                "if(st.maxWidth&&parseInt(st.maxWidth)>vw){st.maxWidth='100%';}" +
                // Fix any fixed width > viewport
                "if(st.width&&parseInt(st.width)>vw){st.width='100%';}" +
                // Force grids to single column on narrow screens
                "if(st.gridTemplateColumns&&st.gridTemplateColumns.indexOf('fr')>-1&&vw<500){" +
                  "if(st.gridTemplateColumns.indexOf('repeat(2')>-1){/*keep 2 cols*/}" +
                  "else{st.gridTemplateColumns='1fr';}" +
                "}" +
                // Fix padding that's too wide
                "if(st.padding){" +
                  "var m=st.padding.match(/(\\d+)px/g);" +
                  "if(m){m.forEach(function(p){if(parseInt(p)>20)st.padding=st.padding.replace(p,'12px');});}" +
                "}" +
              "});" +
              // Dispatch resize to trigger React's isMobile checks
              "window.dispatchEvent(new Event('resize'));" +
            "})();";
        webView.evaluateJavascript(js, null);
    }
}
