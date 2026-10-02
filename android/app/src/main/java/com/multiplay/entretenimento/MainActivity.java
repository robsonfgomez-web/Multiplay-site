package com.multiplay.entretenimento;

import android.app.*;
import android.os.*;
import android.provider.Settings;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.content.*;
import android.net.Uri;
import android.view.*;
import android.widget.*;
import androidx.media3.common.MediaItem;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.*;

public class MainActivity extends Activity {
  private final String API="https://multiplay-site.onrender.com";
  private final String PANEL=API+"/gerenciar.html";
  private LinearLayout root, listBox;
  private String deviceId,deviceKey,playlistName="";
  private ArrayList<Item> items=new ArrayList<>();
  private ExoPlayer player;

  static class Item {
    String name,url,group,logo;
    Item(String n,String u,String g,String l){name=n;url=u;group=g;logo=l;}
  }

  int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
  TextView tv(String s,int z,boolean bold){TextView t=new TextView(this);t.setText(s);t.setTextColor(Color.WHITE);t.setTextSize(z);t.setPadding(dp(10),dp(7),dp(10),dp(7));if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;}
  Button btn(String s){Button b=new Button(this);b.setText(s);b.setTextColor(Color.WHITE);b.setTextSize(12);b.setAllCaps(false);b.setBackgroundColor(Color.rgb(20,100,205));return b;}
  EditText search(){EditText e=new EditText(this);e.setHint("Buscar canal, filme ou série");e.setHintTextColor(Color.rgb(125,140,160));e.setTextColor(Color.WHITE);e.setSingleLine(true);e.setPadding(dp(12),0,dp(12),0);GradientDrawable g=new GradientDrawable();g.setColor(Color.rgb(10,18,32));g.setStroke(dp(1),Color.rgb(32,49,73));g.setCornerRadius(dp(10));e.setBackground(g);return e;}
  public void onCreate(Bundle b){super.onCreate(b);getWindow().setStatusBarColor(Color.rgb(3,7,18));getWindow().setNavigationBarColor(Color.rgb(3,7,18));deviceId=androidId();deviceKey=key();deviceScreen("");new Handler(Looper.getMainLooper()).postDelayed(()->sync(),650);}

  String androidId(){String x=Settings.Secure.getString(getContentResolver(),Settings.Secure.ANDROID_ID);return (x==null||x.isEmpty()?UUID.randomUUID().toString().replace("-",""):x).toUpperCase(Locale.US);}
  String key(){android.content.SharedPreferences p=getSharedPreferences("multiplay",0);String k=p.getString("device_key",null);if(k==null){k=hash(deviceId+"|MULTIPLAY|"+UUID.randomUUID()).substring(0,10).toUpperCase(Locale.US);p.edit().putString("device_key",k).apply();}return k;}
  String hash(String s){try{byte[] x=MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));StringBuilder h=new StringBuilder();for(byte v:x)h.append(String.format("%02x",v));return h.toString();}catch(Exception e){return UUID.randomUUID().toString().replace("-","");}}

  void base(){root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(dp(16),dp(12),dp(16),dp(12));root.setBackgroundColor(Color.rgb(3,7,18));setContentView(root);}
  TextView cardText(String s){TextView t=tv(s,14,true);t.setGravity(Gravity.CENTER_VERTICAL);GradientDrawable g=new GradientDrawable();g.setColor(Color.rgb(10,18,32));g.setStroke(dp(1),Color.rgb(32,49,73));g.setCornerRadius(dp(12));t.setBackground(g);return t;}

  void deviceScreen(String message){
    base();
    LinearLayout head=new LinearLayout(this);
    head.setOrientation(LinearLayout.VERTICAL);
    head.setGravity(Gravity.CENTER);
    TextView logo=tv("MULTI",34,true);logo.setGravity(Gravity.CENTER);logo.setTextColor(Color.rgb(25,223,255));head.addView(logo,new LinearLayout.LayoutParams(-1,dp(42)));
    TextView play=tv("PLAY",18,true);play.setGravity(Gravity.CENTER);play.setTextColor(Color.WHITE);head.addView(play,new LinearLayout.LayoutParams(-1,dp(28)));
    TextView sub=tv("ENTRETENIMENTO",12,true);sub.setGravity(Gravity.CENTER);sub.setTextColor(Color.rgb(150,170,190));head.addView(sub,new LinearLayout.LayoutParams(-1,dp(28)));
    root.addView(head,new LinearLayout.LayoutParams(-1,dp(102)));

    TextView title=tv("Conecte seu dispositivo",24,true);title.setGravity(Gravity.CENTER);root.addView(title,new LinearLayout.LayoutParams(-1,dp(50)));
    TextView info=tv("Use o Device ID e a Device Key abaixo para cadastrar este aparelho no painel Multiplay. Depois, sua playlist autorizada será carregada automaticamente.",13,false);info.setGravity(Gravity.CENTER);root.addView(info,new LinearLayout.LayoutParams(-1,dp(68)));

    LinearLayout ids=new LinearLayout(this);ids.setOrientation(LinearLayout.VERTICAL);
    TextView idCard=cardText("DEVICE ID\n"+deviceId);idCard.setTextSize(15);ids.addView(idCard,new LinearLayout.LayoutParams(-1,dp(76)));
    TextView keyCard=cardText("DEVICE KEY\n"+deviceKey);keyCard.setTextSize(15);LinearLayout.LayoutParams kp=new LinearLayout.LayoutParams(-1,dp(76));kp.setMargins(0,dp(8),0,0);ids.addView(keyCard,kp);
    root.addView(ids,new LinearLayout.LayoutParams(-1,dp(160)));

    TextView panel=tv("PAINEL DE ATIVAÇÃO\n"+PANEL,11,false);panel.setGravity(Gravity.CENTER);panel.setTextColor(Color.rgb(150,170,190));LinearLayout.LayoutParams pp=new LinearLayout.LayoutParams(-1,dp(54));pp.setMargins(0,dp(8),0,dp(4));root.addView(panel,pp);

    Button open=btn("ABRIR PAINEL MULTIPLAY");root.addView(open,new LinearLayout.LayoutParams(-1,dp(46)));open.setOnClickListener(v->{startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(PANEL)));});
    Button sync=btn("↻  ATUALIZAR / CONTINUAR");LinearLayout.LayoutParams sp=new LinearLayout.LayoutParams(-1,dp(50));sp.setMargins(0,dp(7),0,dp(5));root.addView(sync,sp);sync.setOnClickListener(v->sync());

    TextView status=tv(message.isEmpty()?"Aguardando ativação ou atualização...":message,13,true);status.setGravity(Gravity.CENTER);status.setTextColor(message.toLowerCase(Locale.ROOT).contains("não")||message.toLowerCase(Locale.ROOT).contains("erro")?Color.rgb(255,145,145):Color.rgb(255,205,100));root.addView(status,new LinearLayout.LayoutParams(-1,dp(48)));
    TextView legal=tv("Multiplay é um player. Use somente playlists e conteúdos próprios, licenciados ou autorizados.",10,false);legal.setGravity(Gravity.CENTER);legal.setTextColor(Color.rgb(125,140,160));root.addView(legal,new LinearLayout.LayoutParams(-1,dp(42)));
  }

  void sync(){
    Toast.makeText(this,"Consultando painel Multiplay...",Toast.LENGTH_SHORT).show();
    new Thread(()->{
      try{
        String status=get("/api/device/status?device_id="+enc(deviceId)+"&device_key="+enc(deviceKey));
        boolean registered=jsonBool(status,"registered");
        boolean active=jsonBool(status,"active");
        boolean has=jsonBool(status,"has_playlist");
        if(!registered){runOnUiThread(()->deviceScreen("Dispositivo ainda não cadastrado no painel."));return;}
        if(!active){runOnUiThread(()->deviceScreen("Dispositivo inativo ou expirado."));return;}
        if(!has){runOnUiThread(()->deviceScreen("Dispositivo ativo, mas ainda sem playlist."));return;}
        String data=get("/api/device/playlist?device_id="+enc(deviceId)+"&device_key="+enc(deviceKey));
        String url=json(data,"playlist_url"); playlistName=json(data,"playlist_name");
        if(url==null||url.isEmpty()){runOnUiThread(()->deviceScreen("A playlist não foi encontrada."));return;}
        String m3u=getAbsolute(url);
        parseM3U(m3u);
        runOnUiThread(()->home());
      }catch(Exception e){runOnUiThread(()->deviceScreen("Não foi possível sincronizar. Verifique a internet e o painel."));}
    }).start();
  }

  String get(String path)throws Exception{URL u=new URL(API+path);HttpURLConnection c=(HttpURLConnection)u.openConnection();c.setRequestMethod("GET");c.setConnectTimeout(15000);c.setReadTimeout(30000);c.setRequestProperty("Accept","application/json");InputStream in=c.getResponseCode()>=400?c.getErrorStream():c.getInputStream();if(in==null)throw new IOException("HTTP");BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));StringBuilder s=new StringBuilder();String l;while((l=r.readLine())!=null)s.append(l);r.close();return s.toString();}
  String getAbsolute(String url)throws Exception{URL u=new URL(url);HttpURLConnection c=(HttpURLConnection)u.openConnection();c.setConnectTimeout(15000);c.setReadTimeout(60000);c.setRequestProperty("User-Agent","Multiplay/2.1");InputStream in=c.getInputStream();BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));StringBuilder s=new StringBuilder();String l;while((l=r.readLine())!=null)s.append(l).append("\n");r.close();return s.toString();}
  String enc(String s)throws Exception{return URLEncoder.encode(s,"UTF-8");}
  boolean jsonBool(String j,String key){Matcher m=Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(true|false)",Pattern.CASE_INSENSITIVE).matcher(j);return m.find()&&"true".equalsIgnoreCase(m.group(1));}
  String json(String j,String key){Matcher m=Pattern.compile("\""+Pattern.quote(key)+"\"\\s*:\\s*\"([^\"]*)\"").matcher(j);return m.find()?m.group(1).replace("\\\"","\""):null;}

  void parseM3U(String m3u){
    items.clear();String pendingName=null,pendingGroup="",pendingLogo="";
    String[] lines=m3u.replace("\r","").split("\n");
    for(String raw:lines){
      String line=raw.trim();
      if(line.startsWith("#EXTINF")){
        int comma=line.indexOf(',');
        pendingName=comma>=0?line.substring(comma+1).trim(): "Conteúdo";
        pendingGroup=attr(line,"group-title");pendingLogo=attr(line,"tvg-logo");
      }else if(!line.isEmpty()&&!line.startsWith("#")&&pendingName!=null){
        items.add(new Item(pendingName,line,pendingGroup,pendingLogo));pendingName=null;pendingGroup="";pendingLogo="";
      }
    }
  }
  String attr(String line,String key){Matcher m=Pattern.compile(key+"=\"([^\"]*)\"",Pattern.CASE_INSENSITIVE).matcher(line);return m.find()?m.group(1):"";}

  String kind(Item x){
    String g=(x.group+" "+x.name).toLowerCase(Locale.ROOT);
    if(g.matches(".*(filme|movie|vod|cinema|film).*"))return "FILMES";
    if(g.matches(".*(série|serie|series|season|temporada|epis[oó]dio).*"))return "SÉRIES";
    return "TV AO VIVO";
  }

  void home(){base();LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);TextView logo=tv("MULTIPLAY",24,true);logo.setTextColor(Color.rgb(24,221,255));top.addView(logo,new LinearLayout.LayoutParams(0,dp(52),1));Button refresh=btn("↻ ATUALIZAR");top.addView(refresh,new LinearLayout.LayoutParams(dp(110),dp(45)));refresh.setOnClickListener(v->sync());root.addView(top);
    TextView status=tv("Playlist: "+(playlistName.isEmpty()?"Multiplay":playlistName)+"  •  "+items.size()+" itens sincronizados",12,false);root.addView(status,new LinearLayout.LayoutParams(-1,dp(38)));
    EditText q=search();LinearLayout.LayoutParams qp=new LinearLayout.LayoutParams(-1,dp(48));qp.setMargins(0,dp(5),0,dp(8));root.addView(q,qp);
    LinearLayout tabs=new LinearLayout(this);for(String s:new String[]{"TODOS","TV AO VIVO","FILMES","SÉRIES"}){Button b=btn(s);tabs.addView(b,new LinearLayout.LayoutParams(0,dp(45),1));b.setOnClickListener(v->showList((String)v.getTag(),q.getText().toString()));b.setTag(s);}root.addView(tabs);
    listBox=new LinearLayout(this);listBox.setOrientation(LinearLayout.VERTICAL);ScrollView sv=new ScrollView(this);sv.addView(listBox);root.addView(sv,new LinearLayout.LayoutParams(-1,0,1));showList("TODOS","");q.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence s,int st,int c,int a){}public void onTextChanged(CharSequence s,int st,int b,int c){showList("TODOS",s.toString());}public void afterTextChanged(android.text.Editable e){}});}
  void showList(String filter,String query){if(listBox==null)return;listBox.removeAllViews();String qq=query.toLowerCase(Locale.ROOT);int count=0;for(Item x:items){String k=kind(x);if(!filter.equals("TODOS")&&!k.equals(filter))continue;if(!qq.isEmpty()&&!x.name.toLowerCase(Locale.ROOT).contains(qq)&&!x.group.toLowerCase(Locale.ROOT).contains(qq))continue;TextView b=cardText((k.equals("TV AO VIVO")?"📺 ":k.equals("FILMES")?"🎬 ":"🍿 ")+x.name+"\n"+(x.group.isEmpty()?"":x.group));b.setTextSize(14);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(62));p.setMargins(0,dp(4),0,dp(4));listBox.addView(b,p);b.setOnClickListener(v->play(x));if(++count>=500)break;}if(count==0)listBox.addView(tv("Nenhum conteúdo encontrado.",14,false));}
  void play(Item x){base();TextView h=tv(x.name,19,true);root.addView(h,new LinearLayout.LayoutParams(-1,dp(58)));PlayerView pv=new PlayerView(this);root.addView(pv,new LinearLayout.LayoutParams(-1,0,1));Button back=btn("← Voltar à lista");root.addView(back,new LinearLayout.LayoutParams(-1,dp(50)));player=new ExoPlayer.Builder(this).build();pv.setPlayer(player);player.setMediaItem(MediaItem.fromUri(Uri.parse(x.url)));player.prepare();player.play();back.setOnClickListener(v->{if(player!=null){player.release();player=null;}home();});}
  @Override protected void onDestroy(){if(player!=null){player.release();player=null;}super.onDestroy();}
}
