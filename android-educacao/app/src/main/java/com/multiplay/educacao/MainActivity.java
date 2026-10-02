package com.multiplay.educacao;
import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.widget.*;
import android.view.ViewGroup;

public class MainActivity extends Activity {
 LinearLayout root; int dp(float v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}
 TextView t(String s,float z,boolean b){TextView x=new TextView(this);x.setText(s);x.setTextColor(Color.WHITE);x.setTextSize(z);x.setPadding(dp(14),dp(8),dp(14),dp(8));if(b)x.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return x;}
 Button btn(String s){Button b=new Button(this);b.setText(s);b.setTextColor(Color.WHITE);b.setAllCaps(false);b.setBackgroundColor(Color.rgb(22,140,255));return b;}
 public void onCreate(Bundle b){super.onCreate(b);home();}
 void base(){root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(dp(18),dp(16),dp(18),dp(16));root.setBackgroundColor(Color.rgb(5,8,16));setContentView(root);}
 void home(){base();TextView logo=t("MULTIPLAY EDUCAÇÃO",28,true);logo.setGravity(Gravity.CENTER);logo.setTextColor(Color.rgb(22,224,255));root.addView(logo,new LinearLayout.LayoutParams(-1,dp(65)));
 TextView h=t("Aprenda. Leia. Ouça. Evolua.",24,true);h.setGravity(Gravity.CENTER);root.addView(h,new LinearLayout.LayoutParams(-1,dp(65)));
 TextView sub=t("Seu aplicativo educacional para cursos, livros, e-books e audiobooks.",15,false);sub.setGravity(Gravity.CENTER);root.addView(sub,new LinearLayout.LayoutParams(-1,dp(70)));
 LinearLayout grid=new LinearLayout(this);grid.setOrientation(LinearLayout.VERTICAL);
 addCard(grid,"🎓  CURSOS","Cursos profissionalizantes e de desenvolvimento.",()->module("CURSOS","Catálogo de cursos e seu progresso aparecerão aqui."));
 addCard(grid,"📚  LIVROS","Biblioteca digital.",()->module("LIVROS","Livros disponíveis para leitura."));
 addCard(grid,"📖  E-BOOKS","Conteúdos digitais.",()->module("E-BOOKS","E-books disponíveis para leitura."));
 addCard(grid,"🎧  AUDIOBOOKS","Aprenda ouvindo.",()->module("AUDIOBOOKS","Audiobooks disponíveis para reprodução."));
 root.addView(grid,new LinearLayout.LayoutParams(-1,0,1));
 TextView cert=t("Certificados: quando um curso oferecer certificação, ela será disponibilizada conforme as regras da instituição ou responsável pelo conteúdo.",12,false);cert.setGravity(Gravity.CENTER);root.addView(cert,new LinearLayout.LayoutParams(-1,dp(65)));
 }
 void addCard(LinearLayout p,String title,String desc,final Runnable r){LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);c.setPadding(dp(12),dp(8),dp(12),dp(8));c.setBackgroundColor(Color.rgb(13,21,34));TextView a=t(title,18,true);TextView d=t(desc,12,false);c.addView(a);c.addView(d);c.setOnClickListener(v->r.run());LinearLayout.LayoutParams q=new LinearLayout.LayoutParams(-1,0,1);q.setMargins(0,dp(5),0,dp(5));p.addView(c,q);}
 void module(String title,String body){base();TextView h=t(title,26,true);h.setTextColor(Color.rgb(22,224,255));root.addView(h,new LinearLayout.LayoutParams(-1,dp(65)));TextView b=t(body,16,false);b.setGravity(Gravity.TOP);root.addView(b,new LinearLayout.LayoutParams(-1,0,1));Button back=btn("← Voltar");root.addView(back,new LinearLayout.LayoutParams(-1,dp(52)));back.setOnClickListener(v->home());}
}