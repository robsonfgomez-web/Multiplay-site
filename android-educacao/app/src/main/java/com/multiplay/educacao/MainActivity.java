package com.multiplay.educacao;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.*;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;

public class MainActivity extends Activity {
    LinearLayout root, content;
    ScrollView scroll;
    int dp(float v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}

    static class Item {
        String title, author, desc, url, cover, meta;
        Item(String t,String a,String d,String u,String c,String m){title=t;author=a;desc=d;url=u;cover=c;meta=m;}
    }

    final ArrayList<Item> books=new ArrayList<>();
    final ArrayList<Item> audios=new ArrayList<>();
    final ArrayList<Item> ebooks=new ArrayList<>();
    final ArrayList<Item> courses=new ArrayList<>();
    final ArrayList<Item> all=new ArrayList<>();
    final ArrayList<Item> recent=new ArrayList<>();
    android.content.SharedPreferences prefs;
    final int BG=Color.rgb(5,9,18), CARD=Color.rgb(14,23,38), BLUE=Color.rgb(24,143,255), CYAN=Color.rgb(25,224,255), MUTED=Color.rgb(160,178,204);

    public void onCreate(Bundle b){
        super.onCreate(b);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        getWindow().setFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN,android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN);
        hideSystem();
        prefs=getSharedPreferences("multiplay_educacao",MODE_PRIVATE);
        buildCatalog();
        loadRecent();
        home();
    }
    void hideSystem(){
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
    @Override public void onWindowFocusChanged(boolean h){ super.onWindowFocusChanged(h); if(h) hideSystem(); }

    TextView txt(String s,float z,boolean bold){
        TextView x=new TextView(this);
        x.setText(s); x.setTextColor(Color.WHITE); x.setTextSize(z);
        x.setPadding(dp(12),dp(7),dp(12),dp(7));
        if(bold)x.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        return x;
    }

    Button btn(String s){
        Button b=new Button(this);
        b.setText(s); b.setTextColor(Color.WHITE); b.setTextSize(12);
        b.setAllCaps(false); b.setBackgroundColor(Color.rgb(22,140,255));
        return b;
    }

    GradientDrawable bg(int color,int stroke,int radius){
        GradientDrawable g=new GradientDrawable();
        g.setColor(color); g.setStroke(dp(1),stroke); g.setCornerRadius(dp(radius));
        return g;
    }

    void base(){
        scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(5,8,16));
        root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(14),dp(10),dp(14),dp(18));
        root.setBackgroundColor(Color.rgb(5,8,16));
        scroll.addView(root,new ScrollView.LayoutParams(-1,-2));
        setContentView(scroll);
    }

    void home(){
        base();
        header("Seu espaço para aprender, ler e ouvir.");
        LinearLayout hero=new LinearLayout(this); hero.setOrientation(LinearLayout.VERTICAL);
        hero.setPadding(dp(18),dp(18),dp(18),dp(18)); hero.setBackground(bg(Color.rgb(10,34,60),Color.rgb(35,105,170),22));
        TextView a=txt("MULTIPLAY EDUCAÇÃO",25,true); a.setTextColor(CYAN); hero.addView(a);
        TextView b=txt("Aprenda. Leia. Ouça. Evolua.",21,true); b.setPadding(0,dp(5),0,0); hero.addView(b);
        TextView c=txt("Sua biblioteca digital para estudar e aproveitar conteúdo online.",12,false); c.setTextColor(Color.rgb(194,218,242)); hero.addView(c);
        LinearLayout chips=new LinearLayout(this); chips.setPadding(0,dp(14),0,0);
        String[] names={"🎓 Cursos","📚 Livros","🎧 Audiobooks","📖 E-books"};
        for(String n:names){ Button x=btn(n); x.setTextSize(10); LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(42),1); p.setMargins(dp(2),0,dp(2),0); chips.addView(x,p);
            if(n.contains("Cursos"))x.setOnClickListener(v->catalog("CURSOS",courses));
            else if(n.contains("Livros"))x.setOnClickListener(v->catalog("LIVROS",books));
            else if(n.contains("Audiobooks"))x.setOnClickListener(v->catalog("AUDIOBOOKS",audios));
            else x.setOnClickListener(v->catalog("E-BOOKS",ebooks));
        }
        hero.addView(chips); body.addView(hero,new LinearLayout.LayoutParams(-1,-2));
        if(!recent.isEmpty()){ body.addView(section("▶ Continuar de onde parou")); horizontal(recent,4); }
        body.addView(section("🔥 Destaques")); horizontal(books,8);
        body.addView(section("🎧 Ouça agora")); horizontal(audios,6);
        body.addView(section("🎓 Comece um curso")); horizontal(courses,6);
        body.addView(section("📖 Biblioteca digital")); horizontal(ebooks,6);
        TextView f=txt("Conteúdo acessado online nas plataformas responsáveis. Certificados são emitidos pelas instituições quando previstos.",10,false); f.setTextColor(MUTED); f.setPadding(0,dp(20),0,dp(20)); body.addView(f);
    }

    TextView section(String s){ TextView h=txt(s,19,true); h.setTextColor(CYAN); h.setPadding(0,dp(18),0,dp(7)); return h; }

    void header(String sub){
        LinearLayout h=new LinearLayout(this); h.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout brand=new LinearLayout(this); brand.setGravity(Gravity.CENTER_VERTICAL);
        TextView mark=txt("M",23,true); mark.setGravity(Gravity.CENTER); mark.setBackground(bg(BLUE,CYAN,14)); brand.addView(mark,new LinearLayout.LayoutParams(dp(42),dp(42)));
        LinearLayout names=new LinearLayout(this); names.setOrientation(LinearLayout.VERTICAL);
        TextView l=txt("MULTIPLAY",17,true); l.setTextColor(CYAN); names.addView(l);
        TextView e=txt("EDUCAÇÃO",9,true); names.addView(e); brand.addView(names);
        h.addView(brand,new LinearLayout.LayoutParams(0,-2,1));
        Button search=btn("⌕"); search.setTextSize(22); h.addView(search,new LinearLayout.LayoutParams(dp(52),dp(46))); search.setOnClickListener(v->searchScreen());
        body.addView(h);
        TextView st=txt(sub,11,false); st.setTextColor(MUTED); st.setPadding(0,dp(4),0,dp(8)); body.addView(st);
    }

    View bottomNav(){
        LinearLayout bar=new LinearLayout(this); bar.setGravity(Gravity.CENTER); bar.setPadding(dp(5),dp(5),dp(5),dp(5)); bar.setBackground(bg(Color.rgb(9,15,27),Color.rgb(34,52,76),18));
        String[] names={"⌂\\nInício","🎓\\nCursos","📚\\nBiblioteca","♥\\nFavoritos"};
        for(String n:names){ Button b=btn(n); b.setTextSize(10); b.setBackgroundColor(Color.TRANSPARENT); LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(56),1); bar.addView(b,p);
            if(n.startsWith("⌂"))b.setOnClickListener(v->home()); else if(n.startsWith("🎓"))b.setOnClickListener(v->catalog("CURSOS",courses)); else if(n.startsWith("📚"))b.setOnClickListener(v->catalog("BIBLIOTECA",books,ebooks,audios)); else b.setOnClickListener(v->favorites());
        } return bar;
    }

    void horizontal(ArrayList<Item> data,int max){
        HorizontalScrollView hs=new HorizontalScrollView(this); hs.setHorizontalScrollBarEnabled(false);
        LinearLayout row=new LinearLayout(this);
        for(int i=0;i<Math.min(max,data.size());i++){ LinearLayout c=miniCard(data.get(i)); LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(dp(148),dp(238)); p.setMargins(0,0,dp(10),0); row.addView(c,p); }
        hs.addView(row); body.addView(hs);
    }
    LinearLayout miniCard(Item x){
        LinearLayout c=new LinearLayout(this); c.setOrientation(LinearLayout.VERTICAL); c.setPadding(dp(8),dp(8),dp(8),dp(8)); c.setBackground(bg(CARD,Color.rgb(34,54,80),16));
        ImageView im=new ImageView(this); im.setScaleType(ImageView.ScaleType.CENTER_CROP); im.setBackground(bg(Color.rgb(25,43,66),0,12)); c.addView(im,new LinearLayout.LayoutParams(-1,dp(142))); if(x.cover.length()>0)loadCover(im,x.cover,x.title);
        TextView t=txt(x.title,13,true); t.setMaxLines(2); c.addView(t,new LinearLayout.LayoutParams(-1,dp(40)));
        TextView m=txt(x.meta,9,true); m.setTextColor(Color.rgb(108,224,182)); c.addView(m);
        c.setOnClickListener(v->detail(x)); return c;
    }

    LinearLayout bigCard(Item x){
        LinearLayout c=new LinearLayout(this); c.setOrientation(LinearLayout.HORIZONTAL); c.setPadding(dp(10),dp(10),dp(10),dp(10)); c.setBackground(bg(CARD,Color.rgb(34,54,80),18));
        ImageView im=new ImageView(this); im.setScaleType(ImageView.ScaleType.CENTER_CROP); im.setBackground(bg(Color.rgb(25,43,66),0,10)); LinearLayout.LayoutParams ip=new LinearLayout.LayoutParams(dp(92),dp(128)); ip.setMargins(0,0,dp(12),0); c.addView(im,ip); if(x.cover.length()>0)loadCover(im,x.cover,x.title);
        LinearLayout b=new LinearLayout(this); b.setOrientation(LinearLayout.VERTICAL);
        TextView t=txt(x.title,15,true); t.setMaxLines(2); b.addView(t);
        TextView a=txt(x.author,11,false); a.setTextColor(Color.rgb(145,204,255)); b.addView(a);
        TextView m=txt(x.meta,9,true); m.setTextColor(Color.rgb(108,224,182)); b.addView(m);
        TextView d=txt(x.desc,10,false); d.setTextColor(MUTED); d.setMaxLines(2); b.addView(d,new LinearLayout.LayoutParams(-1,dp(42)));
        Button o=btn(x.meta.contains("AUDIO")?"▶ OUVIR":x.meta.contains("ONLINE")?"▶ ESTUDAR":"▶ ABRIR"); b.addView(o,new LinearLayout.LayoutParams(-1,dp(40))); o.setOnClickListener(v->detail(x));
        c.addView(b,new LinearLayout.LayoutParams(0,-2,1)); return c;
    }

    void catalog(String title,ArrayList<Item> data){ catalog(title,data,null,null); }
    void catalog(String title,ArrayList<Item> a,ArrayList<Item> b,ArrayList<Item> c){
        base(); header("Explore "+title.toLowerCase()+" na Multiplay");
        ArrayList<Item> data=new ArrayList<>(); if(a!=null)data.addAll(a); if(b!=null)data.addAll(b); if(c!=null)data.addAll(c);
        TextView n=txt(data.size()+" conteúdos disponíveis",11,false); n.setTextColor(MUTED); body.addView(n);
        for(Item x:data){ LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2); p.setMargins(0,dp(7),0,dp(7)); body.addView(bigCard(x),p); }
    }

    void searchScreen(){
        base(); header("Pesquise por título, autor ou assunto");
        EditText q=new EditText(this); q.setHint("🔎  Buscar na Multiplay Educação"); q.setHintTextColor(Color.rgb(115,137,163)); q.setTextColor(Color.WHITE); q.setSingleLine(true); q.setPadding(dp(14),0,dp(14),0); q.setBackground(bg(CARD,Color.rgb(48,77,106),14)); body.addView(q,new LinearLayout.LayoutParams(-1,dp(52)));
        LinearLayout results=new LinearLayout(this); results.setOrientation(LinearLayout.VERTICAL); body.addView(results);
        q.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int b,int c){} public void onTextChanged(CharSequence s,int a,int b,int c){results.removeAllViews();String z=s.toString().toLowerCase();if(z.length()<2)return;for(Item x:all)if((x.title+" "+x.author+" "+x.meta+" "+x.desc).toLowerCase().contains(z))results.addView(bigCard(x));} public void afterTextChanged(android.text.Editable e){}});
        q.requestFocus(); ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showSoftInput(q,InputMethodManager.SHOW_IMPLICIT);
    }

    void detail(Item x){
        base(); header("Detalhes do conteúdo");
        LinearLayout top=new LinearLayout(this); top.setOrientation(LinearLayout.HORIZONTAL);
        ImageView im=new ImageView(this); im.setScaleType(ImageView.ScaleType.CENTER_CROP); im.setBackground(bg(Color.rgb(25,43,66),0,14)); if(x.cover.length()>0)loadCover(im,x.cover,x.title); top.addView(im,new LinearLayout.LayoutParams(dp(128),dp(182)));
        LinearLayout inf=new LinearLayout(this); inf.setOrientation(LinearLayout.VERTICAL); inf.setPadding(dp(14),0,0,0);
        TextView t=txt(x.title,20,true); t.setMaxLines(4); inf.addView(t); TextView a=txt(x.author,12,false); a.setTextColor(Color.rgb(145,204,255)); inf.addView(a); TextView m=txt(x.meta,9,true);m.setTextColor(Color.rgb(108,224,182));inf.addView(m);
        Button fav=btn(isFav(x)?"♥ Favoritado":"♡ Favoritar");inf.addView(fav,new LinearLayout.LayoutParams(-1,dp(42)));fav.setOnClickListener(v->{toggleFav(x);fav.setText(isFav(x)?"♥ Favoritado":"♡ Favoritar");});
        top.addView(inf,new LinearLayout.LayoutParams(0,-2,1)); body.addView(top);
        body.addView(section("Sobre")); TextView d=txt(x.desc,13,false);d.setTextColor(Color.rgb(204,214,228));body.addView(d);
        Button go=btn(x.meta.contains("AUDIO")?"▶ OUVIR AGORA":x.meta.contains("ONLINE")?"▶ COMEÇAR CURSO":"▶ LER AGORA");go.setTextSize(15);LinearLayout.LayoutParams gp=new LinearLayout.LayoutParams(-1,dp(54));gp.setMargins(0,dp(18),0,dp(10));body.addView(go,gp);go.setOnClickListener(v->{saveRecent(x);openOnline(x);});
        TextView source=txt("Fonte: "+x.author+"\\nO conteúdo é carregado online pela plataforma responsável.",10,false);source.setTextColor(MUTED);body.addView(source);
    }

    void favorites(){
        base(); header("Seus favoritos");
        ArrayList<Item> f=new ArrayList<>();for(Item x:all)if(isFav(x))f.add(x);
        if(f.isEmpty()){TextView e=txt("♡\\n\\nSua biblioteca de favoritos está vazia.\\nAbra um conteúdo e toque em Favoritar.",16,false);e.setTextColor(MUTED);e.setGravity(Gravity.CENTER);body.addView(e,new LinearLayout.LayoutParams(-1,dp(280)));}else for(Item x:f)body.addView(bigCard(x));
    }
    String favKey(Item x){return "fav_"+x.kind+"_"+x.title.hashCode();}
    boolean isFav(Item x){return prefs!=null&&prefs.getBoolean(favKey(x),false);}
    void toggleFav(Item x){prefs.edit().putBoolean(favKey(x),!isFav(x)).apply();}
    void saveRecent(Item x){recent.remove(x);recent.add(0,x);while(recent.size()>8)recent.remove(recent.size()-1);StringBuilder s=new StringBuilder();for(Item y:recent)s.append(y.kind).append("|").append(y.title).append("||");prefs.edit().putString("recent",s.toString()).apply();}
    void loadRecent(){String raw=prefs==null?"":prefs.getString("recent","");if(raw.length()==0)return;for(String z:raw.split("\\\\|\\\\|")){if(z.length()==0)continue;String[] q=z.split("\\\\|",2);if(q.length<2)continue;for(Item x:all)if(x.kind.equals(q[0])&&x.title.equals(q[1])){recent.add(x);break;}}}    void openOnline(Item item){
        base(); header(item.meta.contains("AUDIO")?"Reprodutor":"Conteúdo online");
        LinearLayout top=new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL);
        TextView t=txt(item.title,15,true);t.setMaxLines(2);top.addView(t,new LinearLayout.LayoutParams(0,dp(54),1));
        Button back=btn("← Voltar");top.addView(back,new LinearLayout.LayoutParams(dp(92),dp(46)));body.addView(top);back.setOnClickListener(v->detail(item));
        WebView web=new WebView(this);WebSettings ws=web.getSettings();ws.setJavaScriptEnabled(true);ws.setDomStorageEnabled(true);ws.setBuiltInZoomControls(false);ws.setMediaPlaybackRequiresUserGesture(true);web.setWebViewClient(new WebViewClient());web.setBackgroundColor(Color.WHITE);body.addView(web,new LinearLayout.LayoutParams(-1,0,1));web.loadUrl(item.url);
    }


