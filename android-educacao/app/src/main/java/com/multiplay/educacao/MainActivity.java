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
import java.io.OutputStream;
import java.util.ArrayList;

public class MainActivity extends Activity {
    LinearLayout root, content, body;
    ScrollView scroll;
    int dp(float v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}

    static class Item {
        String title, author, desc, url, cover, meta, kind;
        Item(String t,String a,String d,String u,String c,String m){title=t;author=a;desc=d;url=u;cover=c;meta=m;} Item(String t,String a,String d,String u,String c,String m,String k){this(t,a,d,u,c,m);kind=k;}
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
        rebuildAll();
        if(prefs.getString("edu_token","").trim().length()>0) home(); else loginScreen();
    }
    void loginScreen(){
        base();
        body.setGravity(Gravity.CENTER_HORIZONTAL);
        body.setPadding(dp(24),dp(18),dp(24),dp(60));

        ImageView logo=new ImageView(this);
        logo.setImageResource(com.multiplay.educacao.R.drawable.ic_multiplay_edu);
        logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        logo.setBackground(bg(Color.rgb(7,24,46),Color.rgb(18,105,190),20));
        LinearLayout.LayoutParams lpLogo=new LinearLayout.LayoutParams(dp(112),dp(112));
        lpLogo.setMargins(0,dp(12),0,dp(10));
        body.addView(logo,lpLogo);

        TextView brand=txt("MULTIPLAY",25,true);
        brand.setGravity(Gravity.CENTER);
        body.addView(brand,new LinearLayout.LayoutParams(-1,dp(32)));

        TextView edu=txt("EDUCAÇÃO",12,true);
        edu.setTextColor(Color.rgb(255,145,20));
        edu.setGravity(Gravity.CENTER);
        body.addView(edu,new LinearLayout.LayoutParams(-1,dp(24)));

        TextView slogan=txt("Conhecimento para hoje.",18,true);
        slogan.setGravity(Gravity.CENTER);
        slogan.setPadding(0,dp(2),0,dp(2));
        body.addView(slogan,new LinearLayout.LayoutParams(-1,-2));

        TextView slogan2=txt("Mais oportunidades para sempre.",12,true);
        slogan2.setTextColor(Color.rgb(255,170,40));
        slogan2.setGravity(Gravity.CENTER);
        slogan2.setPadding(0,dp(2),0,dp(2));
        body.addView(slogan2,new LinearLayout.LayoutParams(-1,-2));

        EditText user=new EditText(this);
        user.setHint("Usuário ou e-mail");
        user.setTextColor(Color.WHITE);
        user.setSingleLine(true);
        user.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        user.setBackground(bg(CARD,Color.rgb(48,77,106),12));
        user.setPadding(dp(14),0,dp(14),0);
        user.setHintTextColor(Color.rgb(125,148,177));
        user.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_NEXT);
        LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(-1,dp(52));
        fp.setMargins(0,dp(12),0,dp(8));
        body.addView(user,fp);

        EditText pass=new EditText(this);
        pass.setHint("Senha");
        pass.setTextColor(Color.WHITE);
        pass.setSingleLine(true);
        pass.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        pass.setBackground(bg(CARD,Color.rgb(48,77,106),12));
        pass.setPadding(dp(14),0,dp(14),0);
        pass.setHintTextColor(Color.rgb(125,148,177));
        pass.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_DONE);
        fp=new LinearLayout.LayoutParams(-1,dp(52));
        fp.setMargins(0,0,0,dp(7));
        body.addView(pass,fp);

        TextView error=txt("",11,false);
        error.setTextColor(Color.rgb(255,125,138));
        error.setGravity(Gravity.CENTER);
        body.addView(error,new LinearLayout.LayoutParams(-1,dp(32)));

        Button entrar=btn("ENTRAR");
        entrar.setTextSize(14);
        entrar.setBackground(bg(Color.rgb(9,158,241),Color.rgb(29,198,255),12));
        LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(-1,dp(52));
        bp.setMargins(0,dp(2),0,dp(7));
        body.addView(entrar,bp);

        Button criar=btn("CRIAR CONTA");
        criar.setTextSize(13);
        criar.setBackground(bg(Color.TRANSPARENT,Color.rgb(58,112,165),12));
        LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,dp(50));
        cp.setMargins(0,0,0,dp(10));
        body.addView(criar,cp);
        criar.setOnClickListener(v->supportScreen());

        TextView support=txt("Conhecimento para hoje.\nMais oportunidades para sempre.",10,false);
        support.setTextColor(MUTED);
        support.setGravity(Gravity.CENTER);
        body.addView(support);

        View.OnClickListener doLogin=v->{
            String u=user.getText().toString().trim();
            String p=pass.getText().toString();
            if(u.length()==0||p.length()==0){error.setText("Informe usuário e senha.");return;}
            entrar.setEnabled(false);
            entrar.setText("ENTRANDO...");
            error.setText("");
            new Thread(()->{
                HttpURLConnection conn=null;
                try{
                    URL url=new URL("https://multiplay-site.onrender.com/api/educacao/login");
                    conn=(HttpURLConnection)url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(15000);
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type","application/json; charset=UTF-8");
                    String json="{\"username\":\""+jsonEscape(u)+"\",\"password\":\""+jsonEscape(p)+"\"}";
                    OutputStream out=conn.getOutputStream();
                    out.write(json.getBytes("UTF-8")); out.close();
                    int code=conn.getResponseCode();
                    InputStream stream=code>=200&&code<400?conn.getInputStream():conn.getErrorStream();
                    StringBuilder sb=new StringBuilder();
                    if(stream!=null){byte[] buf=new byte[1024];int n;while((n=stream.read(buf))!=-1)sb.append(new String(buf,0,n,"UTF-8"));stream.close();}
                    String response=sb.toString();
                    final boolean ok=code>=200&&code<300&&response.contains("\"success\":true");
                    final String token=extractJson(response,"token");
                    final String name=extractJson(response,"name");
                    final String message=extractJson(response,"message");
                    runOnUiThread(()->{
                        entrar.setEnabled(true); entrar.setText("ENTRAR");
                        if(ok&&token.length()>0){
                            prefs.edit().putString("edu_token",token).putString("edu_username",u).putString("edu_name",name).apply();
                            ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(pass.getWindowToken(),0);
                            Toast.makeText(this,"Bem-vindo à Multiplay Educação!",Toast.LENGTH_SHORT).show();
                            home();
                        }else error.setText(message.length()>0?message:"Usuário ou senha inválidos.");
                    });
                }catch(Exception ex){
                    runOnUiThread(()->{entrar.setEnabled(true);entrar.setText("ENTRAR");error.setText("Não foi possível conectar ao servidor. Tente novamente.");});
                }finally{if(conn!=null)conn.disconnect();}
            }).start();
        };
        entrar.setOnClickListener(doLogin);
        pass.setOnEditorActionListener((v,action,event)->{doLogin.onClick(v);return true;});
    }

    String extractJson(String json,String key){
        if(json==null)return "";
        String needle="\""+key+"\":\"";
        int i=json.indexOf(needle);
        if(i<0)return "";
        int start=i+needle.length();
        StringBuilder out=new StringBuilder(); boolean esc=false;
        for(int j=start;j<json.length();j++){
            char ch=json.charAt(j);
            if(esc){out.append(ch);esc=false;continue;}
            if(ch=='\\'){esc=true;continue;}
            if(ch=='"')break;
            out.append(ch);
        }
        return out.toString();
    }

    void logoutEducation(){
        prefs.edit().remove("edu_token").remove("edu_username").remove("edu_name").apply();
        loginScreen();
    }

    void hideSystem(){
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
    @Override public void onWindowFocusChanged(boolean h){ super.onWindowFocusChanged(h); if(h) hideSystem(); }

    void rebuildAll(){ all.clear(); all.addAll(courses); all.addAll(books); all.addAll(ebooks); all.addAll(audios); }

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
        root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(BG);
        body=new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(14),dp(10),dp(14),dp(90));
        scroll=new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(BG);
        scroll.addView(body,new ScrollView.LayoutParams(-1,-1));
        root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        root.addView(bottomNav());
        setContentView(root);
    }

    void home(){
        base();
        body.setPadding(dp(12),dp(10),dp(12),dp(82));

        // HOME OFICIAL — fiel ao esboço aprovado da Multiplay Educação:
        // logo compacta, chamada, busca, atalhos, indicadores e cursos.
        LinearLayout brandBlock=new LinearLayout(this);
        brandBlock.setOrientation(LinearLayout.VERTICAL);
        brandBlock.setGravity(Gravity.CENTER_HORIZONTAL);
        brandBlock.setPadding(0,dp(8),0,dp(4));

        ImageView logo=new ImageView(this);
        logo.setImageResource(com.multiplay.educacao.R.drawable.ic_multiplay_edu);
        logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        logo.setBackground(bg(Color.rgb(7,24,46),Color.rgb(18,105,190),18));
        LinearLayout.LayoutParams lpLogo=new LinearLayout.LayoutParams(dp(92),dp(92));
        lpLogo.setMargins(0,0,0,dp(5));
        brandBlock.addView(logo,lpLogo);

        TextView brand=txt("MULTIPLAY",24,true);
        brand.setGravity(Gravity.CENTER);
        brand.setPadding(0,0,0,0);
        brandBlock.addView(brand,new LinearLayout.LayoutParams(-1,dp(30)));

        TextView edu=txt("EDUCAÇÃO",11,true);
        edu.setTextColor(Color.rgb(255,145,20));
        edu.setGravity(Gravity.CENTER);
        edu.setPadding(0,0,0,dp(3));
        brandBlock.addView(edu,new LinearLayout.LayoutParams(-1,dp(22)));

        TextView slogan=txt("Conhecimento para hoje.",18,true);
        slogan.setGravity(Gravity.CENTER);
        slogan.setTextColor(Color.WHITE);
        brandBlock.addView(slogan,new LinearLayout.LayoutParams(-1,dp(30)));

        TextView slogan2=txt("Mais oportunidades para sempre.",12,true);
        slogan2.setGravity(Gravity.CENTER);
        slogan2.setTextColor(Color.rgb(255,170,40));
        brandBlock.addView(slogan2,new LinearLayout.LayoutParams(-1,dp(24)));

        body.addView(brandBlock,new LinearLayout.LayoutParams(-1,-2));

        EditText q=new EditText(this);
        q.setSingleLine(true);
        q.setHint("⌕  O que você quer aprender hoje?");
        q.setHintTextColor(Color.rgb(145,158,178));
        q.setTextColor(Color.rgb(20,30,45));
        q.setTextSize(12);
        q.setPadding(dp(14),0,dp(14),0);
        q.setBackground(bg(Color.WHITE,0,14));
        LinearLayout.LayoutParams qp=new LinearLayout.LayoutParams(-1,dp(50));
        qp.setMargins(0,dp(7),0,dp(8));
        body.addView(q,qp);
        q.setOnEditorActionListener((v,action,event)->{
            if(!q.getText().toString().trim().isEmpty()) searchScreen();
            return true;
        });

        LinearLayout cats=new LinearLayout(this);
        cats.setGravity(Gravity.CENTER);
        String[] names={"🎓 Cursos","📚 Livros","🎧 Audiobooks","📖 E-books","🏆 Certificados"};
        for(String n:names){
            Button x=btn(n);
            x.setTextSize(8);
            x.setPadding(dp(1),0,dp(1),0);
            x.setTextColor(Color.WHITE);
            x.setBackground(bg(Color.rgb(7,154,235),Color.rgb(18,191,255),7));
            LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(48),1);
            p.setMargins(dp(2),0,dp(2),0);
            cats.addView(x,p);
            if(n.contains("Cursos"))x.setOnClickListener(v->catalog("CURSOS",courses));
            else if(n.contains("Livros"))x.setOnClickListener(v->catalog("LIVROS",books));
            else if(n.contains("Audiobooks"))x.setOnClickListener(v->catalog("AUDIOBOOKS",audios));
            else if(n.contains("E-books"))x.setOnClickListener(v->catalog("E-BOOKS",ebooks));
            else x.setOnClickListener(v->supportScreen());
        }
        body.addView(cats);

        LinearLayout stats=new LinearLayout(this);
        stats.setPadding(0,dp(9),0,dp(4));
        stats.addView(statBox("900+","CURSOS"),new LinearLayout.LayoutParams(0,dp(68),1));
        stats.addView(statBox(String.valueOf(books.size()),"LIVROS"),new LinearLayout.LayoutParams(0,dp(68),1));
        stats.addView(statBox(String.valueOf(audios.size()),"AUDIOBOOKS"),new LinearLayout.LayoutParams(0,dp(68),1));
        stats.addView(statBox(String.valueOf(ebooks.size()),"E-BOOKS"),new LinearLayout.LayoutParams(0,dp(68),1));
        body.addView(stats);

        Button loja=btn("🛍  MINHA MULTIPLAY EDUCAÇÃO");
        loja.setTextSize(12);
        loja.setBackground(bg(Color.rgb(9,158,241),Color.rgb(29,198,255),5));
        LinearLayout.LayoutParams lojaP=new LinearLayout.LayoutParams(-1,dp(52));
        lojaP.setMargins(0,dp(4),0,dp(5));
        body.addView(loja,lojaP);
        loja.setOnClickListener(v->openCatalogWeb(
            "https://multiplay-site.onrender.com/educacao.html",
            "Multiplay Educação"
        ));

        if(!recent.isEmpty()){
            body.addView(section("▶  Continuar estudando"));
            horizontal(recent,4);
        }

        body.addView(section("🔥  Cursos em destaque"));
        horizontal(courses,6);

        body.addView(section("📚  Livros e e-books"));
        horizontal(books,5);

        body.addView(section("🎧  Audiobooks"));
        horizontal(audios,5);

        body.addView(section("🎓  Catálogo de cursos"));
        Button evg=btn("MAIS DE 800 CURSOS • CATÁLOGO EV.G");
        evg.setTextSize(12);
        LinearLayout.LayoutParams ep=new LinearLayout.LayoutParams(-1,dp(52));
        ep.setMargins(0,dp(4),0,dp(6));
        body.addView(evg,ep);
        evg.setOnClickListener(v->openCatalogWeb(
            "https://www.escolavirtual.gov.br/catalogo",
            "Catálogo EV.G • cursos gratuitos"
        ));

        Button mec=btn("CATÁLOGO APRENDA MAIS • MEC");
        mec.setTextSize(12);
        LinearLayout.LayoutParams mp=new LinearLayout.LayoutParams(-1,dp(52));
        mp.setMargins(0,0,0,dp(8));
        body.addView(mec,mp);
        mec.setOnClickListener(v->openCatalogWeb(
            "https://aprendamais.mec.gov.br/course/index.php?lang=pt_br",
            "Aprenda Mais • MEC"
        ));

        TextView src=txt(
            "Os catálogos oficiais são carregados online e podem receber novos cursos sem precisar atualizar o aplicativo.",
            10,false
        );
        src.setTextColor(MUTED);
        body.addView(src);

        TextView f=txt(
            "Conteúdos acessados online nas plataformas responsáveis. Certificados são emitidos pelas instituições quando previstos.",
            10,false
        );
        f.setTextColor(MUTED);
        f.setPadding(0,dp(16),0,dp(20));
        body.addView(f);
    }

    LinearLayout statBox(String n,String label){ LinearLayout c=new LinearLayout(this); c.setOrientation(LinearLayout.VERTICAL); c.setGravity(Gravity.CENTER); c.setBackground(bg(CARD,Color.rgb(34,54,80),14)); TextView a=txt(n,18,true); a.setGravity(Gravity.CENTER); a.setTextColor(CYAN); c.addView(a); TextView b=txt(label,8,true); b.setGravity(Gravity.CENTER); b.setTextColor(MUTED); c.addView(b); return c; }

    TextView section(String s){ TextView h=txt(s,19,true); h.setTextColor(CYAN); h.setPadding(0,dp(18),0,dp(7)); return h; }

    void header(String sub){
        LinearLayout h=new LinearLayout(this); h.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout brand=new LinearLayout(this); brand.setGravity(Gravity.CENTER_VERTICAL);
        ImageView logo=new ImageView(this);
        logo.setImageResource(com.multiplay.educacao.R.drawable.ic_multiplay_edu);
        logo.setScaleType(ImageView.ScaleType.CENTER_CROP);
        logo.setPadding(dp(2),dp(2),dp(2),dp(2));
        logo.setBackground(bg(Color.rgb(15,83,150),CYAN,14));
        brand.addView(logo,new LinearLayout.LayoutParams(dp(50),dp(50)));
        LinearLayout names=new LinearLayout(this); names.setOrientation(LinearLayout.VERTICAL); names.setPadding(dp(9),0,0,0);
        TextView l=txt("MULTIPLAY",18,true); l.setTextColor(Color.WHITE); names.addView(l);
        TextView e=txt("EDUCAÇÃO • APRENDA • LEIA • OUÇA",8,true); e.setTextColor(Color.rgb(255,166,64)); names.addView(e); brand.addView(names);
        h.addView(brand,new LinearLayout.LayoutParams(0,-2,1));
        Button search=btn("⌕"); search.setTextSize(22); h.addView(search,new LinearLayout.LayoutParams(dp(52),dp(46))); search.setOnClickListener(v->searchScreen());
        body.addView(h);
        TextView st=txt(sub,11,false); st.setTextColor(MUTED); st.setPadding(0,dp(4),0,dp(2)); body.addView(st); Button account=btn("👤 "+(prefs.getString("edu_username","Aluno"))); account.setTextSize(9); account.setBackgroundColor(Color.TRANSPARENT); body.addView(account,new LinearLayout.LayoutParams(-1,dp(32))); account.setOnClickListener(v->logoutEducation());    }

    View bottomNav(){
        LinearLayout bar=new LinearLayout(this); bar.setGravity(Gravity.CENTER); bar.setPadding(dp(5),dp(5),dp(5),dp(5)); bar.setBackground(bg(Color.rgb(9,15,27),Color.rgb(34,52,76),18));
        String[] names={"⌂\\nInício","🎓\\nCursos","📚\\nBiblioteca","♥\\nFavoritos"};
        for(String n:names){ Button b=btn(n); b.setTextSize(10); b.setBackgroundColor(Color.TRANSPARENT); LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(56),1); bar.addView(b,p);
            if(n.startsWith("⌂"))b.setOnClickListener(v->home()); else if(n.startsWith("🎓"))b.setOnClickListener(v->catalog("CURSOS",courses)); else if(n.startsWith("📚"))b.setOnClickListener(v->catalog("BIBLIOTECA",books,ebooks,audios)); else if(n.startsWith("♥"))b.setOnClickListener(v->favorites()); else b.setOnClickListener(v->supportScreen());
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
        Button o=btn("AUDIO".equals(x.kind)?"▶ OUVIR":"CURSO".equals(x.kind)?"▶ ESTUDAR":"▶ ABRIR"); b.addView(o,new LinearLayout.LayoutParams(-1,dp(40))); o.setOnClickListener(v->detail(x));
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
        q.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int b,int c){} public void onTextChanged(CharSequence s,int a,int b,int c){results.removeAllViews();String z=s.toString().toLowerCase();if(z.length()<2){ TextView hint=txt("Digite pelo menos 2 caracteres para pesquisar.",12,false); hint.setTextColor(MUTED); results.addView(hint); return; }for(Item x:all)if((x.title+" "+x.author+" "+x.meta+" "+x.desc).toLowerCase().contains(z))results.addView(bigCard(x));} public void afterTextChanged(android.text.Editable e){}});
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
        Button go=btn("AUDIO".equals(x.kind)?"▶ OUVIR AGORA":"CURSO".equals(x.kind)?"▶ COMEÇAR CURSO":"▶ LER AGORA");go.setTextSize(15);LinearLayout.LayoutParams gp=new LinearLayout.LayoutParams(-1,dp(54));gp.setMargins(0,dp(18),0,dp(10));body.addView(go,gp);go.setOnClickListener(v->{saveRecent(x);openOnline(x);});
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
    void saveRecent(Item x){recent.remove(x);recent.add(0,x);while(recent.size()>8)recent.remove(recent.size()-1);StringBuilder s=new StringBuilder();for(Item y:recent)s.append(y.kind).append("\u0001").append(y.title).append("\u0002");prefs.edit().putString("recent_v2",s.toString()).apply();}
    void loadRecent(){String raw=prefs==null?"":prefs.getString("recent_v2","");if(raw.length()==0)return;for(String z:raw.split("\u0002")){if(z.length()==0)continue;String[] q=z.split("\u0001",2);if(q.length<2)continue;for(Item x:all)if(q[0].equals(x.kind)&&q[1].equals(x.title)){if(!recent.contains(x))recent.add(x);break;}}}
    void loadCover(ImageView image,String url,String title){
        new Thread(()->{try{
            HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
            c.setConnectTimeout(7000); c.setReadTimeout(9000); c.setUseCaches(true);
            InputStream in=c.getInputStream(); final Bitmap b=BitmapFactory.decodeStream(in); in.close();
            runOnUiThread(()->{if(b!=null)image.setImageBitmap(b);});
        }catch(Exception ignored){}}).start();
    }

    void openCatalogWeb(String url,String title){
        base();
        header(title);
        WebView web=new WebView(this);
        WebSettings ws=web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        ws.setSupportZoom(true);
        web.setWebViewClient(new WebViewClient());
        web.setBackgroundColor(Color.WHITE);
        body.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        web.loadUrl(url);
    }

    void openOnline(Item item){
        base(); header("AUDIO".equals(item.kind)?"Reprodutor de áudio":"Conteúdo online");
        LinearLayout top=new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL);
        TextView t=txt(item.title,15,true);t.setMaxLines(2);top.addView(t,new LinearLayout.LayoutParams(0,dp(54),1));
        Button back=btn("← Voltar");top.addView(back,new LinearLayout.LayoutParams(dp(92),dp(46)));body.addView(top);back.setOnClickListener(v->detail(item));
        WebView web=new WebView(this);WebSettings ws=web.getSettings();ws.setJavaScriptEnabled(true);ws.setDomStorageEnabled(true);ws.setBuiltInZoomControls(false);ws.setMediaPlaybackRequiresUserGesture(true);web.setWebViewClient(new WebViewClient());web.setBackgroundColor(Color.WHITE);body.addView(web,new LinearLayout.LayoutParams(-1,0,1));web.loadUrl(item.url);
    }

    void buildCatalog(){
        String G="https://www.gutenberg.org/cache/epub/";
        addBook("Orgulho e Preconceito","Jane Austen","Clássico completo para leitura online.","https://www.gutenberg.org/ebooks/1342",G+"1342/pg1342.cover.medium.jpg");
        addBook("Alice no País das Maravilhas","Lewis Carroll","Clássico completo.","https://www.gutenberg.org/ebooks/11",G+"11/pg11.cover.medium.jpg");
        addBook("Frankenstein","Mary Shelley","Romance completo.","https://www.gutenberg.org/ebooks/84",G+"84/pg84.cover.medium.jpg");
        addBook("As Aventuras de Sherlock Holmes","Arthur Conan Doyle","Contos completos.","https://www.gutenberg.org/ebooks/1661",G+"1661/pg1661.cover.medium.jpg");
        addBook("Moby Dick","Herman Melville","Romance completo.","https://www.gutenberg.org/ebooks/2701",G+"2701/pg2701.cover.medium.jpg");
        addBook("Um Conto de Duas Cidades","Charles Dickens","Romance completo.","https://www.gutenberg.org/ebooks/98",G+"98/pg98.cover.medium.jpg");
        addBook("Grandes Esperanças","Charles Dickens","Romance completo.","https://www.gutenberg.org/ebooks/1400",G+"1400/pg1400.cover.medium.jpg");
        addBook("As Aventuras de Tom Sawyer","Mark Twain","Clássico completo.","https://www.gutenberg.org/ebooks/74",G+"74/pg74.cover.medium.jpg");
        addBook("As Aventuras de Huckleberry Finn","Mark Twain","Clássico completo.","https://www.gutenberg.org/ebooks/76",G+"76/pg76.cover.medium.jpg");
        addBook("Jane Eyre","Charlotte Brontë","Romance completo.","https://www.gutenberg.org/ebooks/1260",G+"1260/pg1260.cover.medium.jpg");
        addBook("O Morro dos Ventos Uivantes","Emily Brontë","Romance completo.","https://www.gutenberg.org/ebooks/768",G+"768/pg768.cover.medium.jpg");
        addBook("Mulherzinhas","Louisa May Alcott","Romance completo.","https://www.gutenberg.org/ebooks/514",G+"514/pg514.cover.medium.jpg");
        addBook("O Maravilhoso Mágico de Oz","L. Frank Baum","Clássico infantil completo.","https://www.gutenberg.org/ebooks/55",G+"55/pg55.cover.medium.jpg");
        addBook("O Jardim Secreto","Frances Hodgson Burnett","Clássico completo.","https://www.gutenberg.org/ebooks/113",G+"113/pg113.cover.medium.jpg");
        addBook("A Máquina do Tempo","H. G. Wells","Ficção científica completa.","https://www.gutenberg.org/ebooks/35",G+"35/pg35.cover.medium.jpg");
        addBook("O Retrato de Dorian Gray","Oscar Wilde","Romance completo.","https://www.gutenberg.org/ebooks/174",G+"174/pg174.cover.medium.jpg");
        addBook("O Conde de Monte Cristo","Alexandre Dumas","Romance completo.","https://www.gutenberg.org/ebooks/1184",G+"1184/pg1184.cover.medium.jpg");
        addBook("A Metamorfose","Franz Kafka","Novela completa.","https://www.gutenberg.org/ebooks/5200",G+"5200/pg5200.cover.medium.jpg");
        addBook("Guerra e Paz","Leo Tolstoy","Romance completo.","https://www.gutenberg.org/ebooks/2600",G+"2600/pg2600.cover.medium.jpg");
        addBook("Um Conto de Natal","Charles Dickens","Clássico completo.","https://www.gutenberg.org/ebooks/46",G+"46/pg46.cover.medium.jpg");

        addAudio("Alice's Adventures in Wonderland","LibriVox","Audiobook completo • inglês.","https://librivox.org/alices-adventures-in-wonderland-by-lewis-carroll/",G+"11/pg11.cover.medium.jpg");
        addAudio("Dracula","LibriVox","Audiobook completo • inglês.","https://librivox.org/dracula-by-bram-stoker",G+"345/pg345.cover.medium.jpg");
        addAudio("Frankenstein; or The Modern Prometheus","LibriVox","Audiobook completo • inglês.","https://librivox.org/frankenstein-or-the-modern-prometheus-1818-by-mary-wollstonecraft-shelley/",G+"84/pg84.cover.medium.jpg");
        addAudio("The Count of Monte Cristo","LibriVox","Audiobook completo • inglês.","https://librivox.org/the-count-of-monte-cristo-by-alexandre-dumas/",G+"1184/pg1184.cover.medium.jpg");
        addAudio("The Adventures of Sherlock Holmes","LibriVox","Audiobook completo • inglês.","https://librivox.org/the-adventures-of-sherlock-holmes-by-arthur-conan-doyle/",G+"1661/pg1661.cover.medium.jpg");
        addAudio("The Time Machine","LibriVox","Audiobook completo • inglês.","https://librivox.org/the-time-machine-by-h-g-wells/",G+"35/pg35.cover.medium.jpg");
        addAudio("Jane Eyre","LibriVox","Audiobook completo • inglês.","https://librivox.org/jane-eyre-by-charlotte-bronte/",G+"1260/pg1260.cover.medium.jpg");
        addAudio("The Picture of Dorian Gray","LibriVox","Audiobook completo • inglês.","https://librivox.org/the-picture-of-dorian-gray-by-oscar-wilde/",G+"174/pg174.cover.medium.jpg");

        addEbook("College Algebra","OpenStax","Livro-texto completo e gratuito online.","https://openstax.org/books/college-algebra/pages/1-introduction-to-prerequisites","MATEMÁTICA");
        addEbook("Psychology 2e","OpenStax","Livro-texto completo e gratuito online.","https://openstax.org/books/psychology-2e/pages/1-introduction","PSICOLOGIA");
        addEbook("Principles of Management","OpenStax","Livro-texto completo e gratuito online.","https://openstax.org/books/principles-management/pages/1-introduction","ADMINISTRAÇÃO");
        addEbook("Algebra 1","OpenStax","Currículo aberto completo online.","https://openstax.org/books/algebra-1/pages/about-this-course","MATEMÁTICA");
        addEbook("College Success","OpenStax","Recursos educacionais gratuitos.","https://openstax.org/subjects/college-success","DESENVOLVIMENTO");
        addEbook("Business","OpenStax","Biblioteca de materiais de negócios.","https://openstax.org/subjects/business","NEGÓCIOS");
        addEbook("Computer Science","OpenStax","Materiais gratuitos de computação.","https://openstax.org/subjects/computer-science","TECNOLOGIA");
        addEbook("Science","OpenStax","Biblioteca de ciências.","https://openstax.org/subjects/science","CIÊNCIAS");

        // Ampliação da biblioteca: obras em domínio público e catálogos educacionais abertos.
        String[][] moreBooks={
            {"O Grande Gatsby","F. Scott Fitzgerald","Romance clássico disponível gratuitamente.","64317"},
            {"A Odisseia","Homero","Épico clássico em tradução para inglês.","1727"},
            {"A Ilíada","Homero","Épico clássico em tradução para inglês.","3059"},
            {"Anne de Green Gables","L. M. Montgomery","Clássico juvenil.","45"},
            {"O Médico e o Monstro","Robert Louis Stevenson","Clássico de suspense.","43"},
            {"As Aventuras de Pinóquio","Carlo Collodi","Clássico infantil.","500"},
            {"O Pequeno Príncipe","Antoine de Saint-Exupéry","Obra literária amplamente conhecida; disponibilidade depende da edição/região.","-1"},
            {"O Livro da Selva","Rudyard Kipling","Clássico de aventura.","236"},
            {"Peter Pan","J. M. Barrie","Clássico infantil.","16"},
            {"A Ilha do Tesouro","Robert Louis Stevenson","Clássico de aventura.","120"},
            {"O Chamado da Selva","Jack London","Clássico de aventura.","215"},
            {"Caninos Brancos","Jack London","Clássico de aventura.","910"},
            {"A Letra Escarlate","Nathaniel Hawthorne","Romance clássico.","25344"},
            {"A Casa dos Sete Gables","Nathaniel Hawthorne","Romance clássico.","512"},
            {"Middlemarch","George Eliot","Romance clássico.","145"},
            {"David Copperfield","Charles Dickens","Romance clássico.","766"},
            {"Oliver Twist","Charles Dickens","Romance clássico.","730"},
            {"A Ilha Misteriosa","Jules Verne","Aventura e ficção científica.","1268"},
            {"Vinte Mil Léguas Submarinas","Jules Verne","Aventura e ficção científica.","164"},
            {"Da Terra à Lua","Jules Verne","Ficção científica clássica.","18857"},
            {"A Volta ao Mundo em 80 Dias","Jules Verne","Aventura clássica.","103"},
            {"Os Três Mosqueteiros","Alexandre Dumas","Aventura clássica.","1257"},
            {"Os Miseráveis","Victor Hugo","Romance clássico.","135"},
            {"O Conde de Monte Cristo — edição adicional","Alexandre Dumas","Outra edição pública do clássico.","1184"}
        };
        for(String[] b:moreBooks){
            if(!"-1".equals(b[3])) addBook(b[0],b[1],b[2],"https://www.gutenberg.org/ebooks/"+b[3],G+b[3]+"/pg"+b[3]+".cover.medium.jpg");
        }

        String[][] moreAudio={
            {"The Great Gatsby","F. Scott Fitzgerald","64317"},
            {"The Odyssey","Homer","1727"},
            {"The Iliad","Homer","3059"},
            {"Anne of Green Gables","L. M. Montgomery","45"},
            {"The Strange Case of Dr Jekyll and Mr Hyde","R. L. Stevenson","43"},
            {"The Jungle Book","Rudyard Kipling","236"},
            {"Peter Pan","J. M. Barrie","16"},
            {"Treasure Island","R. L. Stevenson","120"},
            {"The Call of the Wild","Jack London","215"},
            {"White Fang","Jack London","910"},
            {"The Scarlet Letter","Nathaniel Hawthorne","25344"},
            {"David Copperfield","Charles Dickens","766"},
            {"Oliver Twist","Charles Dickens","730"},
            {"The Mysterious Island","Jules Verne","1268"},
            {"Twenty Thousand Leagues Under the Sea","Jules Verne","164"},
            {"Around the World in Eighty Days","Jules Verne","103"},
            {"The Three Musketeers","Alexandre Dumas","1257"},
            {"Les Misérables","Victor Hugo","135"},
            {"The Wonderful Wizard of Oz","L. Frank Baum","55"},
            {"A Christmas Carol","Charles Dickens","46"},
            {"The Secret Garden","Frances Hodgson Burnett","113"},
            {"The Wind in the Willows","Kenneth Grahame","289"},
            {"The Adventures of Tom Sawyer","Mark Twain","74"},
            {"The Adventures of Huckleberry Finn","Mark Twain","76"}
        };
        for(String[] a:moreAudio){
            addAudio(a[0],"LibriVox","Audiobook disponível online • inglês.","https://librivox.org/search?title="+a[0].replace(" ","+").replace("&","%26"),G+a[2]+"/pg"+a[2]+".cover.medium.jpg");
        }

        String[][] moreEbooks={
            {"Biology 2e","OpenStax","https://openstax.org/books/biology-2e/pages/1-introduction","BIOLOGIA"},
            {"Chemistry 2e","OpenStax","https://openstax.org/books/chemistry-2e/pages/1-introduction","QUÍMICA"},
            {"Anatomy and Physiology 2e","OpenStax","https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction","SAÚDE"},
            {"Microbiology","OpenStax","https://openstax.org/books/microbiology/pages/1-introduction","BIOLOGIA"},
            {"Nutrition 2e","OpenStax","https://openstax.org/books/nutrition-2e/pages/1-introduction","NUTRIÇÃO"},
            {"Astronomy 2e","OpenStax","https://openstax.org/books/astronomy-2e/pages/1-introduction","ASTRONOMIA"},
            {"Introduction to Sociology 3e","OpenStax","https://openstax.org/books/introduction-sociology-3e/pages/1-introduction","SOCIOLOGIA"},
            {"Principles of Economics 3e","OpenStax","https://openstax.org/books/principles-economics-3e/pages/1-introduction","ECONOMIA"},
            {"Introduction to Business","OpenStax","https://openstax.org/books/introduction-business/pages/1-introduction","NEGÓCIOS"},
            {"Organizational Behavior","OpenStax","https://openstax.org/books/organizational-behavior/pages/1-introduction","GESTÃO"},
            {"Principles of Marketing","OpenStax","https://openstax.org/books/principles-marketing/pages/1-introduction","MARKETING"},
            {"Business Law I","OpenStax","https://openstax.org/books/business-law-i/pages/1-introduction","DIREITO"},
            {"Financial Accounting","OpenStax","https://openstax.org/books/financial-accounting/pages/1-introduction","CONTABILIDADE"},
            {"Managerial Accounting","OpenStax","https://openstax.org/books/managerial-accounting/pages/1-introduction","CONTABILIDADE"},
            {"Calculus Volume 1","OpenStax","https://openstax.org/books/calculus-volume-1/pages/1-introduction","MATEMÁTICA"},
            {"Calculus Volume 2","OpenStax","https://openstax.org/books/calculus-volume-2/pages/1-introduction","MATEMÁTICA"},
            {"Calculus Volume 3","OpenStax","https://openstax.org/books/calculus-volume-3/pages/1-introduction","MATEMÁTICA"},
            {"University Physics Volume 1","OpenStax","https://openstax.org/books/university-physics-volume-1/pages/1-introduction","FÍSICA"},
            {"University Physics Volume 2","OpenStax","https://openstax.org/books/university-physics-volume-2/pages/1-introduction","FÍSICA"},
            {"University Physics Volume 3","OpenStax","https://openstax.org/books/university-physics-volume-3/pages/1-introduction","FÍSICA"},
            {"Physics 2e","OpenStax","https://openstax.org/books/physics-2e/pages/1-introduction","FÍSICA"},
            {"College Physics 2e","OpenStax","https://openstax.org/books/college-physics-2e/pages/1-introduction","FÍSICA"},
            {"Prealgebra 2e","OpenStax","https://openstax.org/books/prealgebra-2e/pages/1-introduction","MATEMÁTICA"},
            {"Elementary Algebra 2e","OpenStax","https://openstax.org/books/elementary-algebra-2e/pages/1-introduction","MATEMÁTICA"},
            {"Intermediate Algebra 2e","OpenStax","https://openstax.org/books/intermediate-algebra-2e/pages/1-introduction","MATEMÁTICA"}
        };
        for(String[] e:moreEbooks) addEbook(e[0],"OpenStax","Livro-texto aberto e gratuito online.",e[2],e[3]);

        addCourse("Excel na Prática","Fundação Bradesco","16h • online • certificado gratuito após aprovação.","https://www.ev.org.br/cursos/excel-na-pratica");
        addCourse("Atendimento ao Público","Fundação Bradesco","10h • online • certificado conforme regras do curso.","https://www.ev.org.br/cursos/atendimento-ao-publico");
        addCourse("Introdução à Administração","Fundação Bradesco","12h • online.","https://www.ev.org.br/cursos/introducao-a-administracao");
        addCourse("Introdução à Gestão de Projetos","Fundação Bradesco","10h • online.","https://www.ev.org.br/cursos/introducao-a-gestao-de-projetos");
        addCourse("Comunicação Escrita: Ortografia, Gramática e Texto","Fundação Bradesco","16h • online.","https://www.ev.org.br/cursos/comunicacao_escrita");
        addCourse("Introdução à Análise de Dados - Microsoft Power BI","Fundação Bradesco","5h • online.","https://www.ev.org.br/cursos/introducao-a-analise-de-dados-microsoft-power-bi");
        addCourse("Análise de Dados no Power BI","Fundação Bradesco","4h • online.","https://www.ev.org.br/cursos/analise-de-dados-no-power-bi");
        addCourse("FluêncIA em Inteligência Artificial","Fundação Bradesco","4h • online • certificado após aprovação.","https://www.ev.org.br/cursos/fluencia");
        addCourse("Inteligência Artificial para Estudantes","Fundação Bradesco","4h • online • certificado após aprovação.","https://www.ev.org.br/cursos/iaestudantes");
        addCourse("Inteligência Artificial para Educadores","Fundação Bradesco","4h • online • certificado após aprovação.","https://www.ev.org.br/cursos/iaeduc");
        addCourse("Inteligência Artificial para Pequenas e Médias Empresas","Fundação Bradesco","4h • online.","https://www.ev.org.br/cursos/pmes");
        addCourse("IA para seu novo emprego: Do currículo à entrevista","Fundação Bradesco","2h • online.","https://www.ev.org.br/cursos/iaempregos");
        addCourse("Administração: fundamentos — Turma 2026B","Aprenda Mais • MEC / IFRS","40h • português • autoinstrucional • certificado conforme regras da plataforma.","https://aprendamais.mec.gov.br/course/search.php?search=Administra%C3%A7%C3%A3o%20fundamentos");
        addCourse("Elaboração e Análise de Projetos — Turma 2026B","Aprenda Mais • MEC / IFRS","30h • português • autoinstrucional • certificado.","https://aprendamais.mec.gov.br/course/search.php?search=Elabora%C3%A7%C3%A3o%20e%20An%C3%A1lise%20de%20Projetos");
        addCourse("Empreendedorismo — Turma 2026B","Aprenda Mais • MEC / IFRS","40h • português • autoinstrucional • certificado.","https://aprendamais.mec.gov.br/course/search.php?search=Empreendedorismo");
        addCourse("Gestão de Marketing — Turma 2026B","Aprenda Mais • MEC / IFRS","20h • português • autoinstrucional • certificado.","https://aprendamais.mec.gov.br/course/search.php?search=Gest%C3%A3o%20de%20Marketing");
        addCourse("Marketing Digital e Redes Sociais — Turma 2026B","Aprenda Mais • MEC / IFRS","20h • português • autoinstrucional • certificado.","https://aprendamais.mec.gov.br/course/search.php?search=Marketing%20Digital%20e%20Redes%20Sociais");
        addCourse("Marketing Empresarial e Pessoal — Turma 2026B","Aprenda Mais • MEC / IFRS","30h • português • autoinstrucional • certificado.","https://aprendamais.mec.gov.br/course/search.php?search=Marketing%20Empresarial%20e%20Pessoal");
        addCourse("Gestão de Projetos de Software com PMBOK — Turma 2026A","Aprenda Mais • MEC / IFRS","40h • português • fundamentos de projetos de software.","https://aprendamais.mec.gov.br/course/search.php?search=Gest%C3%A3o%20de%20Projetos%20de%20Software%20com%20PMBOK");
        addCourse("Programas de capacitação EV.G — Escola Virtual de Governo","Escola Virtual de Governo","Catálogo com centenas de cursos gratuitos; muitos com certificado digital após aprovação.","https://www.escolavirtual.gov.br/catalogo");
        addCourse("Aprenda Mais — Cursos abertos do MEC","Aprenda Mais • MEC","Catálogo de cursos online abertos, gratuitos e certificados para concluintes.","https://aprendamais.mec.gov.br/");        for(int i=0;i<courses.size();i++){ courses.get(i).cover = new String[]{
            "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80"
        }[i%4];}
    }

    void addBook(String t,String a,String d,String u,String c){books.add(new Item(t,a,d,u,c,"LIVRO","LIVRO")); }
    void addAudio(String t,String a,String d,String u,String c){audios.add(new Item(t,a,d,u,c,"AUDIO","AUDIO")); }
    void addEbook(String t,String a,String d,String u,String m){ebooks.add(new Item(t,a,d,u,"",m));}
    void addCourse(String t,String a,String d,String u){courses.add(new Item(t,a,d,u,"","CURSO","CURSO"));}


    void supportScreen(){
        base();
        header("Tire suas dúvidas com a equipe Multiplay");

        TextView intro=txt("Envie sua dúvida, solicitação ou dificuldade. Nossa equipe poderá responder e acompanhar o atendimento por aqui.",12,false);
        intro.setTextColor(MUTED);
        body.addView(intro);

        EditText name=new EditText(this);
        name.setHint("Seu nome");
        name.setHintTextColor(Color.rgb(115,137,163));
        name.setTextColor(Color.WHITE);
        name.setSingleLine(true);
        name.setBackground(bg(CARD,Color.rgb(48,77,106),14));
        name.setPadding(dp(14),0,dp(14),0);
        LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(-1,dp(52));
        fp.setMargins(0,dp(10),0,0);
        body.addView(name,fp);

        EditText email=new EditText(this);
        email.setHint("Seu e-mail");
        email.setHintTextColor(Color.rgb(115,137,163));
        email.setTextColor(Color.WHITE);
        email.setSingleLine(true);
        email.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        email.setBackground(bg(CARD,Color.rgb(48,77,106),14));
        email.setPadding(dp(14),0,dp(14),0);
        fp=new LinearLayout.LayoutParams(-1,dp(52));
        fp.setMargins(0,dp(8),0,0);
        body.addView(email,fp);

        EditText subject=new EditText(this);
        subject.setHint("Assunto");
        subject.setHintTextColor(Color.rgb(115,137,163));
        subject.setTextColor(Color.WHITE);
        subject.setSingleLine(true);
        subject.setBackground(bg(CARD,Color.rgb(48,77,106),14));
        subject.setPadding(dp(14),0,dp(14),0);
        fp=new LinearLayout.LayoutParams(-1,dp(52));
        fp.setMargins(0,dp(8),0,0);
        body.addView(subject,fp);

        EditText message=new EditText(this);
        message.setHint("Digite sua dúvida ou mensagem");
        message.setHintTextColor(Color.rgb(115,137,163));
        message.setTextColor(Color.WHITE);
        message.setGravity(Gravity.TOP|Gravity.START);
        message.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        message.setBackground(bg(CARD,Color.rgb(48,77,106),14));
        message.setPadding(dp(14),dp(12),dp(14),dp(12));
        fp=new LinearLayout.LayoutParams(-1,dp(150));
        fp.setMargins(0,dp(8),0,0);
        body.addView(message,fp);

        Button send=btn("💬 ENVIAR PARA O SUPORTE");
        send.setTextSize(14);
        fp=new LinearLayout.LayoutParams(-1,dp(54));
        fp.setMargins(0,dp(14),0,dp(8));
        body.addView(send,fp);

        TextView ai=txt("🤖 Em uma próxima evolução, a IA poderá responder dúvidas comuns imediatamente e encaminhar casos específicos para a equipe.",10,false);
        ai.setTextColor(MUTED);
        body.addView(ai);

        send.setOnClickListener(v->{
            String n=name.getText().toString().trim();
            String e=email.getText().toString().trim();
            String s=subject.getText().toString().trim();
            String m=message.getText().toString().trim();
            if(n.length()==0||e.length()==0||s.length()==0||m.length()==0){
                Toast.makeText(this,"Preencha todos os campos.",Toast.LENGTH_SHORT).show();
                return;
            }
            send.setEnabled(false);
            new Thread(()->{
                HttpURLConnection conn=null;
                try{
                    URL u=new URL("https://multiplay-site.onrender.com/api/educacao/support/tickets");
                    conn=(HttpURLConnection)u.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(15000);
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type","application/json; charset=UTF-8");
                    String json="{\"name\":\""+jsonEscape(n)+"\",\"email\":\""+jsonEscape(e)+"\",\"subject\":\""+jsonEscape(s)+"\",\"message\":\""+jsonEscape(m)+"\"}";
                    OutputStream out=conn.getOutputStream();
                    out.write(json.getBytes("UTF-8"));
                    out.close();
                    int code=conn.getResponseCode();
                    runOnUiThread(()->{
                        send.setEnabled(true);
                        if(code>=200&&code<300){
                            message.setText("");
                            subject.setText("");
                            Toast.makeText(this,"Dúvida enviada. A equipe responderá pelo suporte.",Toast.LENGTH_LONG).show();
                        }else{
                            Toast.makeText(this,"Não foi possível enviar agora. Tente novamente.",Toast.LENGTH_LONG).show();
                        }
                    });
                }catch(Exception ex){
                    runOnUiThread(()->{
                        send.setEnabled(true);
                        Toast.makeText(this,"Sem conexão com o suporte. Tente novamente.",Toast.LENGTH_LONG).show();
                    });
                }finally{
                    if(conn!=null)conn.disconnect();
                }
            }).start();
        });
    }

    String jsonEscape(String value){
        if(value==null)return "";
        return value.replace("\\","\\\\").replace("\"","\\\"").replace("\r","\\r").replace("\n","\\n");
    }


    @Override public void onBackPressed(){ home(); }
}
// Multiplay Educação 1.3.2 — hero landing visual.

// Multiplay Educação 1.3.3 — login de aluno e sessão.
