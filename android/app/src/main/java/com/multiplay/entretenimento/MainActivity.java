package com.multiplay.entretenimento;

import android.app.Activity;
import android.os.Bundle;
import android.provider.Settings;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.widget.*;
import android.net.Uri;
import androidx.media3.common.MediaItem;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.UUID;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStreamReader;
import java.io.BufferedReader;

public class MainActivity extends Activity {
 private LinearLayout root; private String deviceId,deviceKey;
 int dp(float v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}
 TextView tv(String s,float z,boolean b){TextView t=new TextView(this);t.setText(s);t.setTextColor(Color.WHITE);t.setTextSize(z);t.setGravity(Gravity.CENTER_VERTICAL);t.setPadding(dp(8),dp(5),dp(8),dp(5));if(b)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;}
 Button btn(String s){Button b=new Button(this);b.setText(s);b.setTextColor(Color.WHITE);b.setTextSize(13);b.setAllCaps(false);b.setBackgroundColor(Color.rgb(25,88,180));return b;}
 public void onCreate(Bundle b){super.onCreate(b);getWindow().setStatusBarColor(Color.rgb(5,8,20));getWindow().setNavigationBarColor(Color.rgb(5,8,20));deviceId=androidId();deviceKey=key();deviceScreen();}
 String androidId(){String x=Settings.Secure.getString(getContentResolver(),Settings.Secure.ANDROID_ID);return (x==null||x.isEmpty()?UUID.randomUUID().toString().replace("-",""):x).toUpperCase(Locale.US);}
 String key(){android.content.SharedPreferences p=getSharedPreferences("multiplay",0);String k=p.getString("device_key",null);if(k==null){k=hash(deviceId+"|MULTIPLAY|"+UUID.randomUUID()).substring(0,12).toUpperCase(Locale.US);p.edit().putString("device_key",k).apply();}return k;}
 String hash(String s){try{byte[] x=MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));StringBuilder h=new StringBuilder();for(byte v:x)h.append(String.format("%02x",v));return h.toString();}catch(Exception e){return UUID.randomUUID().toString().replace("-","");}}
 void base(){root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(dp(28),dp(18),dp(28),dp(18));root.setBackgroundColor(Color.rgb(5,8,20));setContentView(root);}
 void deviceScreen(){base();TextView logo=tv("MULTIPLAY",32,true);logo.setTextColor(Color.rgb(40,140,255));logo.setGravity(Gravity.CENTER);root.addView(logo,new LinearLayout.LayoutParams(-1,dp(60)));TextView sub=tv("ENTRETENIMENTO",14,true);sub.setGravity(Gravity.CENTER);root.addView(sub,new LinearLayout.LayoutParams(-1,dp(30)));TextView title=tv("Ative este dispositivo",24,true);title.setGravity(Gravity.CENTER);root.addView(title,new LinearLayout.LayoutParams(-1,dp(52)));
 LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(22),dp(8),dp(22),dp(8));card.setBackgroundColor(Color.rgb(15,22,40));card.addView(tv("DEVICE ID\n"+deviceId,15,true),new LinearLayout.LayoutParams(-1,dp(72)));card.addView(tv("DEVICE KEY\n"+deviceKey,15,true),new LinearLayout.LayoutParams(-1,dp(72)));root.addView(card,new LinearLayout.LayoutParams(-1,dp(160)));
 TextView info=tv("Identificador próprio do Multiplay para vincular a playlist.\nO MAC físico pode não estar disponível em Android comum.",12,false);info.setGravity(Gravity.CENTER);root.addView(info,new LinearLayout.LayoutParams(-1,dp(58)));
 Button a=btn("ATIVAR / SINCRONIZAR DISPOSITIVO");root.addView(a,new LinearLayout.LayoutParams(-1,dp(52)));a.setOnClickListener(v->sync());
 TextView l=tv("Use somente conteúdo próprio, licenciado ou autorizado.",11,false);l.setGravity(Gravity.CENTER);root.addView(l,new LinearLayout.LayoutParams(-1,dp(45)));}
 void openPlayer(String url,String title){ base(); TextView h=tv(title,20,true); root.addView(h,new LinearLayout.LayoutParams(-1,dp(55))); PlayerView pv=new PlayerView(this); root.addView(pv,new LinearLayout.LayoutParams(-1,0,1)); Button back=btn("← Voltar"); root.addView(back,new LinearLayout.LayoutParams(-1,dp(48))); ExoPlayer player=new ExoPlayer.Builder(this).build(); pv.setPlayer(player); player.setMediaItem(MediaItem.fromUri(Uri.parse(url))); player.prepare(); player.play(); back.setOnClickListener(v->{player.release();home();}); }
 void module(String title,String body){ base(); TextView h=tv(title,26,true); h.setTextColor(Color.rgb(40,140,255)); root.addView(h,new LinearLayout.LayoutParams(-1,dp(65))); TextView b=tv(body,16,false); b.setGravity(Gravity.TOP); root.addView(b,new LinearLayout.LayoutParams(-1,0,1)); Button back=btn("← Voltar"); root.addView(back,new LinearLayout.LayoutParams(-1,dp(50))); back.setOnClickListener(v->home()); }
 void sync(){
  Toast.makeText(this,"Sincronizando dispositivo...",Toast.LENGTH_SHORT).show();
  new Thread(()->{
    try{
      String api=getString(getResources().getIdentifier("server_url","string",getPackageName()));
      URL u=new URL(api+"/api/device/status?device_id="+deviceId+"&device_key="+deviceKey);
      HttpURLConnection c=(HttpURLConnection)u.openConnection(); c.setConnectTimeout(10000); c.setReadTimeout(10000);
      BufferedReader br=new BufferedReader(new InputStreamReader(c.getInputStream()));
      StringBuilder out=new StringBuilder(); String line; while((line=br.readLine())!=null) out.append(line); br.close();
      runOnUiThread(()->home(out.toString()));
    }catch(Exception e){runOnUiThread(()->{Toast.makeText(this,"Não foi possível sincronizar agora.",Toast.LENGTH_LONG).show();home();});}
  }).start();
}
void home(){home("");}
void home(String status){base();LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);TextView logo=tv("MULTIPLAY",28,true);logo.setTextColor(Color.rgb(40,140,255));top.addView(logo,new LinearLayout.LayoutParams(0,dp(55),1));top.addView(tv("DEVICE KEY  "+deviceKey,12,false),new LinearLayout.LayoutParams(dp(180),dp(55)));root.addView(top);
 LinearLayout nav=new LinearLayout(this);for(String s:new String[]{"INÍCIO","TV AO VIVO","FILMES","SÉRIES","LIVROS","AUDIOBOOK","E-BOOKS"}){Button x=btn(s);nav.addView(x,new LinearLayout.LayoutParams(0,dp(45),1)); if(s.equals("TV AO VIVO"))x.setOnClickListener(v->module("TV AO VIVO","Canais vinculados à playlist autorizada do dispositivo aparecerão aqui.")); if(s.equals("FILMES"))x.setOnClickListener(v->module("FILMES","Catálogo VOD da playlist autorizada.")); if(s.equals("SÉRIES"))x.setOnClickListener(v->module("SÉRIES","Séries e temporadas da playlist autorizada.")); if(s.equals("LIVROS"))x.setOnClickListener(v->module("LIVROS","Biblioteca digital de livros disponibilizados legalmente.")); if(s.equals("AUDIOBOOK"))x.setOnClickListener(v->module("AUDIOBOOKS","Audiobooks e conteúdos em áudio.")); if(s.equals("E-BOOKS"))x.setOnClickListener(v->module("E-BOOKS","E-books e publicações digitais."));}root.addView(nav);
 TextView h=tv("Sua central de entretenimento",25,true);h.setPadding(dp(10),dp(16),dp(10),dp(4));root.addView(h,new LinearLayout.LayoutParams(-1,dp(62)));
 LinearLayout grid=new LinearLayout(this);for(String s:new String[]{"📺  Canais","🎬  Filmes","📚  Livros","🎧  Audiobooks","📖  E-books","🎓  Cursos"}){TextView c=tv(s,15,true);c.setGravity(Gravity.CENTER);c.setBackgroundColor(Color.rgb(15,22,40));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(110),1);p.setMargins(dp(5),dp(5),dp(5),dp(5));grid.addView(c,p);}root.addView(grid,new LinearLayout.LayoutParams(-1,dp(125)));
 TextView st=tv((status.isEmpty()?"Playlist: aguardando vínculo no painel":status)+"\nDevice ID: "+deviceId+"\nCursos: gratuitos; certificado somente quando oferecido pela instituição responsável.",12,false);st.setGravity(Gravity.CENTER);root.addView(st,new LinearLayout.LayoutParams(-1,dp(55)));}
}