package com.multiplay.educacao;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
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

    public void onCreate(Bundle b){
        super.onCreate(b);
        buildCatalog();
        home();
    }

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
        TextView logo=txt("MULTIPLAY EDUCAÇÃO",25,true);
        logo.setGravity(Gravity.CENTER);
        logo.setTextColor(Color.rgb(22,224,255));
        root.addView(logo,new LinearLayout.LayoutParams(-1,dp(55)));

        TextView hero=txt("Aprenda. Leia. Ouça. Evolua.",23,true);
        hero.setGravity(Gravity.CENTER);
        root.addView(hero,new LinearLayout.LayoutParams(-1,dp(55)));

        TextView sub=txt("Conteúdo digital online: cursos, livros, e-books e audiobooks.",13,false);
        sub.setGravity(Gravity.CENTER);
        sub.setTextColor(Color.rgb(180,195,215));
        root.addView(sub,new LinearLayout.LayoutParams(-1,dp(55)));

        LinearLayout tabs=new LinearLayout(this);
        String[] names={"🎓 Cursos","📚 Livros","📖 E-books","🎧 Audiobooks"};
        for(String n:names){
            Button b=btn(n);
            LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(50),1);
            p.setMargins(dp(3),0,dp(3),dp(6));
            tabs.addView(b,p);
            if(n.contains("Cursos"))b.setOnClickListener(v->catalog("CURSOS",courses));
            else if(n.contains("Livros"))b.setOnClickListener(v->catalog("LIVROS",books));
            else if(n.contains("E-books"))b.setOnClickListener(v->catalog("E-BOOKS",ebooks));
            else b.setOnClickListener(v->catalog("AUDIOBOOKS",audios));
        }
        root.addView(tabs,new LinearLayout.LayoutParams(-1,dp(56)));

        addSection(root,"📚 Biblioteca de livros",books,3);
        addSection(root,"🎧 Audiobooks completos",audios,3);
        addSection(root,"📖 E-books educacionais",ebooks,3);
        addSection(root,"🎓 Cursos online com certificação",courses,4);

        TextView note=txt("Os conteúdos abrem nas plataformas oficiais. Certificados são emitidos pela instituição responsável quando previstos e após o cumprimento das regras do curso.",11,false);
        note.setTextColor(Color.rgb(155,170,190)); root.addView(note);
    }

    void addSection(LinearLayout p,String title,ArrayList<Item> data,int limit){
        TextView h=txt(title,20,true); h.setTextColor(Color.rgb(22,224,255)); p.addView(h);
        for(int i=0;i<Math.min(limit,data.size());i++) addCard(p,data.get(i));
        if(data.size()>limit){
            Button more=btn("Ver todos • "+data.size()+" conteúdos");
            p.addView(more,new LinearLayout.LayoutParams(-1,dp(46)));
            more.setOnClickListener(v->catalog(title,data));
        }
    }

    void addCard(LinearLayout p,Item item){
        LinearLayout card=new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setPadding(dp(8),dp(8),dp(8),dp(8));
        card.setBackground(bg(Color.rgb(13,21,34),Color.rgb(29,50,75),14));

        ImageView cover=new ImageView(this);
        cover.setScaleType(ImageView.ScaleType.CENTER_CROP);
        cover.setBackground(bg(Color.rgb(25,45,70),Color.rgb(40,75,105),8));
        LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(dp(82),dp(112));
        cp.setMargins(0,0,dp(10),0); card.addView(cover,cp);
        if(item.cover!=null && !item.cover.isEmpty())loadCover(cover,item.cover,item.title);
        else {
            cover.setImageDrawable(null);
            cover.setContentDescription(item.title);
        }

        LinearLayout body=new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL);
        TextView title=txt(item.title,16,true); body.addView(title);
        TextView author=txt(item.author,11,false); author.setTextColor(Color.rgb(145,205,255)); body.addView(author);
        TextView meta=txt(item.meta,10,true); meta.setTextColor(Color.rgb(120,220,180)); body.addView(meta);
        TextView desc=txt(item.desc,11,false); desc.setTextColor(Color.rgb(190,200,215)); body.addView(desc,new LinearLayout.LayoutParams(-1,dp(58)));
        Button open=btn(item.meta.contains("CURSO")?"▶ ESTUDAR":item.meta.contains("AUDIO")?"▶ OUVIR":"▶ ABRIR");
        body.addView(open,new LinearLayout.LayoutParams(-1,dp(42)));
        open.setOnClickListener(v->openOnline(item));
        card.addView(body,new LinearLayout.LayoutParams(0,-2,1));

        LinearLayout.LayoutParams q=new LinearLayout.LayoutParams(-1,-2);
        q.setMargins(0,dp(6),0,dp(6)); p.addView(card,q);
    }

    void loadCover(ImageView image,String url,String title){
        new Thread(()->{
            try{
                HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
                c.setConnectTimeout(8000); c.setReadTimeout(10000); c.setUseCaches(true);
                InputStream in=c.getInputStream(); Bitmap b=BitmapFactory.decodeStream(in); in.close();
                runOnUiThread(()->{if(b!=null)image.setImageBitmap(b);});
            }catch(Exception ignored){}
        }).start();
    }

    void catalog(String title,ArrayList<Item> data){
        base();
        LinearLayout head=new LinearLayout(this); head.setGravity(Gravity.CENTER_VERTICAL);
        TextView h=txt(title,23,true); h.setTextColor(Color.rgb(22,224,255));
        head.addView(h,new LinearLayout.LayoutParams(0,dp(58),1));
        Button back=btn("← Início"); head.addView(back,new LinearLayout.LayoutParams(dp(90),dp(48)));
        back.setOnClickListener(v->home()); root.addView(head);
        TextView info=txt(data.size()+" conteúdos disponíveis online",12,false);
        info.setTextColor(Color.rgb(155,170,190)); root.addView(info);
        for(Item x:data)addCard(root,x);
    }

    void openOnline(Item item){
        base();
        LinearLayout head=new LinearLayout(this); head.setGravity(Gravity.CENTER_VERTICAL);
        Button back=btn("← Voltar"); head.addView(back,new LinearLayout.LayoutParams(dp(95),dp(48)));
        TextView h=txt(item.title,16,true); head.addView(h,new LinearLayout.LayoutParams(0,dp(58),1));
        root.addView(head);
        TextView attribution=txt("Fonte oficial: "+item.author+"\nConteúdo acessado online.",10,false);
        attribution.setTextColor(Color.rgb(155,170,190)); root.addView(attribution,new LinearLayout.LayoutParams(-1,dp(48)));

        WebView web=new WebView(this);
        WebSettings ws=web.getSettings();
        ws.setJavaScriptEnabled(true); ws.setDomStorageEnabled(true);
        ws.setBuiltInZoomControls(false); ws.setLoadWithOverviewMode(true); ws.setUseWideViewPort(true);
        web.setWebViewClient(new WebViewClient());
        root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        web.loadUrl(item.url);
        back.setOnClickListener(v->home());
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
    }

    void addBook(String t,String a,String d,String u,String c){books.add(new Item(t,a,d,u,c,"LIVRO")); }
    void addAudio(String t,String a,String d,String u,String c){audios.add(new Item(t,a,d,u,c,"AUDIO")); }
    void addEbook(String t,String a,String d,String u,String m){ebooks.add(new Item(t,a,d,u,"",m));}
    void addCourse(String t,String a,String d,String u){courses.add(new Item(t,a,d,u,"","CURSO"));}

    @Override public void onBackPressed(){
        home();
    }
}
