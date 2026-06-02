package com.fixtray.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

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
                injectViewportCSS(webView);
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
