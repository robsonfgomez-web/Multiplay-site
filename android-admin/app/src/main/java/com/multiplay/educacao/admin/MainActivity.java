package com.multiplay.educacao.admin;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {
    private WebView web;
    private final String PANEL = "https://multiplay-site.onrender.com/educacao-admin.html";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(7,17,29));
        getWindow().setNavigationBarColor(Color.rgb(5,11,20));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(5,11,20));

        TextView title = new TextView(this);
        title.setText("MULTIPLAY EDUCAÇÃO • ADMIN");
        title.setTextColor(Color.WHITE);
        title.setTextSize(15);
        title.setGravity(17);
        title.setPadding(8,10,8,10);
        title.setBackgroundColor(Color.rgb(7,17,29));
        root.addView(title, new LinearLayout.LayoutParams(-1,52));

        ProgressBar progress = new ProgressBar(this);
        progress.setVisibility(View.GONE);
        root.addView(progress, new LinearLayout.LayoutParams(-1,4));

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(true);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setUserAgentString(s.getUserAgentString()+" MultiplayEducacaoAdmin/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView v,int p){
                progress.setVisibility(p<100?View.VISIBLE:View.GONE);
                super.onProgressChanged(v,p);
            }
        });
        root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(root);
        web.loadUrl(PANEL);
    }

    @Override public void onBackPressed(){
        if(web!=null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override protected void onPause(){
        CookieManager.getInstance().flush();
        super.onPause();
    }
}
