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
import android.text.*;
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
  private LinearLayout root,listBox;
  private String deviceId,deviceKey,playlistName="";
  private ArrayList<Item> items=new ArrayList<>();
  private ExoPlayer player;
  private String currentFilter="TODOS";
  static class Item {
    String name,url,group,logo;
    Item(String n,String u,String g,String l){name=n;url=u;group=g;logo=l;}
  }

  int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
  TextView text(String s,int z,boolean bold){
    TextView t=new TextView(this); t.setText(s); t.setTextColor(Color.WHITE); t.setTextSize(z);
    t.setPadding(dp(10),dp(7),dp(10),dp(7)); if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD); return t;
  }
  Button button(String s){
    Button b=new Button(this); b.setText(s); b.setTextColor(Color.WHITE); b.setTextSize(12); b.setAllCaps(false);
    b.setBackgroundColor(Color.rgb(70,40,160)); return b;
  }
  EditText search(){
    EditText e=new EditText(this); e.setHint("Buscar canal, filme ou série"); e.setHintTextColor(Color.rgb(145,150,175));
    e.setTextColor(Color.WHITE); e.setSingleLine(true); e.setPadding(dp(12),0,dp(12),0);
    GradientDrawable g=new GradientDrawable(); g.setColor(Color.rgb(20,10,38)); g.setStroke(dp(1),Color.rgb(80,55,120)); g.setCornerRadius(dp(12)); e.setBackground(g); return e;
  }
  @Override public void onCreate(Bundle b){
    super.onCreate(b); getWindow().setStatusBarColor(Color.rgb(8,2,25)); getWindow().setNavigationBarColor(Color.rgb(8,2,25));
    deviceId=androidId(); deviceKey=key(); home("Carregando sua biblioteca...");
    new Handler(Looper.getMainLooper()).postDelayed(()->sync(),250);
  }
  String androidId(){String x=Settings.Secure.getString(getContentResolver(),Settings.Secure.ANDROID_ID);return (x==null||x.isEmpty()?UUID.randomUUID().toString().replace("-",""):x).toUpperCase(Locale.US);}
  String key(){android.content.SharedPreferences p=getSharedPreferences("multiplay",0);String k=p.getString("device_key",null);if(k==null){k=hash(deviceId+"|MULTIPLAY|"+UUID.randomUUID()).substring(0,10).toUpperCase(Locale.US);p.edit().putString("device_key",k).apply();}return k;}
  String hash(String s){try{byte[] x=MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));StringBuilder h=new StringBuilder();for(byte v:x)h.append(String.format("%02x",v));return h.toString();}catch(Exception e){return UUID.randomUUID().toString().replace("-","");}}
  void base(){
    ScrollView page=new ScrollView(this);
    page.setFillViewport(true);
    page.setBackgroundColor(Color.rgb(8,2,25));
    root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(14),dp(8),dp(14),dp(10));
    root.setBackgroundColor(Color.rgb(8,2,25));
    page.addView(root,new ScrollView.LayoutParams(-1,-2));
    setContentView(page);
  }
  TextView pill(String s){
    TextView t=text(s,12,true); t.setGravity(Gravity.CENTER);
    GradientDrawable g=new GradientDrawable();g.setColor(Color.rgb(34,18,62));g.setStroke(dp(1),Color.rgb(80,55,120));g.setCornerRadius(dp(18));t.setBackground(g);return t;
  }
  void home(String notice){
    base();
    LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);
    TextView logo=text("M  Multi",23,true);logo.setTextColor(Color.rgb(35,220,255));top.addView(logo,new LinearLayout.LayoutParams(0,dp(50),1));
    TextView brand=text("PLAY",23,true);brand.setTextColor(Color.rgb(255,128,25));top.addView(brand,new LinearLayout.LayoutParams(dp(80),dp(50)));
    Button configTop=button("⚙ Config");top.addView(configTop,new LinearLayout.LayoutParams(dp(90),dp(45)));configTop.setOnClickListener(v->showDeviceInfo()); Button refresh=button("↻ Atualizar");top.addView(refresh,new LinearLayout.LayoutParams(dp(105),dp(45)));refresh.setOnClickListener(v->sync());
    root.addView(top);

    LinearLayout nav=new LinearLayout(this);nav.setGravity(Gravity.CENTER);String[] ns={"⌂ Início","📺 TV ao Vivo","🎬 Filmes","🍿 Séries","★ Favoritos","⌕ Buscar"};
    for(String n:ns){TextView p=pill(n);LinearLayout.LayoutParams q=new LinearLayout.LayoutParams(0,dp(42),1);q.setMargins(dp(3),0,dp(3),0);nav.addView(p,q);
      p.setOnClickListener(v->{String z=((TextView)v).getText().toString();if(z.contains("TV"))showList("TV AO VIVO","");else if(z.contains("Filmes"))showList("FILMES","");else if(z.contains("Séries"))showList("SÉRIES","");else if(z.contains("Buscar")){if(listBox!=null)showList("TODOS","");}});
    }
    root.addView(nav,new LinearLayout.LayoutParams(-1,dp(50)));

    LinearLayout hero=new LinearLayout(this);hero.setOrientation(LinearLayout.VERTICAL);hero.setPadding(dp(18),dp(14),dp(18),dp(14));
    GradientDrawable hg=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{Color.rgb(45,12,70),Color.rgb(12,8,35)});hg.setCornerRadius(dp(18));hero.setBackground(hg);
    TextView h1=text("MULTIPLAY ENTRETENIMENTO",22,true);h1.setTextColor(Color.WHITE);hero.addView(h1);
    TextView h2=text("TV • FILMES • SÉRIES",13,true);h2.setTextColor(Color.rgb(180,210,255));hero.addView(h2);
    TextView h3=text("Sua biblioteca em um só lugar. Use Atualizar para sincronizar a playlist autorizada.",12,false);h3.setTextColor(Color.rgb(200,195,215));hero.addView(h3);
    LinearLayout actions=new LinearLayout(this);
    Button cont=button("▶  CONTINUAR");actions.addView(cont,new LinearLayout.LayoutParams(0,dp(46),1));
    Button panel=button("⚙ MEU DISPOSITIVO");actions.addView(panel,new LinearLayout.LayoutParams(0,dp(46),1));
    cont.setOnClickListener(v->continueWatching());panel.setOnClickListener(v->showDeviceInfo());
    hero.addView(actions);root.addView(hero,new LinearLayout.LayoutParams(-1,LinearLayout.LayoutParams.WRAP_CONTENT));

    TextView st=text(notice,11,true);st.setTextColor(Color.rgb(170,155,190));root.addView(st,new LinearLayout.LayoutParams(-1,dp(38)));
    LinearLayout cats=new LinearLayout(this);String[] c={"📺 Ao vivo","🎬 Filmes","🍿 Séries","↻ Repetir","⌕ Buscar"};
    for(String s:c){Button b=button(s);LinearLayout.LayoutParams q=new LinearLayout.LayoutParams(0,dp(55),1);q.setMargins(dp(3),0,dp(3),0);cats.addView(b,q);
      b.setOnClickListener(v->{if(s.contains("Filmes"))showList("FILMES","");else if(s.contains("Séries"))showList("SÉRIES","");else if(s.contains("Ao vivo"))showList("TV AO VIVO","");else if(s.contains("Repetir"))continueWatching();});
    }root.addView(cats,new LinearLayout.LayoutParams(-1,LinearLayout.LayoutParams.WRAP_CONTENT));

    EditText q=search();LinearLayout.LayoutParams qp=new LinearLayout.LayoutParams(-1,dp(46));qp.setMargins(0,dp(8),0,dp(6));root.addView(q,qp);
    listBox=new LinearLayout(this);listBox.setOrientation(LinearLayout.VERTICAL);
    root.addView(listBox,new LinearLayout.LayoutParams(-1,LinearLayout.LayoutParams.WRAP_CONTENT));
    q.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int c,int d){}public void onTextChanged(CharSequence s,int a,int b,int c){showList(currentFilter,s.toString());}public void afterTextChanged(Editable e){}});
    showList("TODOS","");
  }
  Button copyButton(String label,String value){
    Button b=button(label);
    b.setOnClickListener(v->{
      android.content.ClipboardManager cm=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
      cm.setPrimaryClip(android.content.ClipData.newPlainText("Multiplay",value));
      Toast.makeText(this,"Copiado para a área de transferência.",Toast.LENGTH_SHORT).show();
    });
    return b;
  }
  TextView infoValue(String label,String value){
    TextView t=text(label+"\n"+value,14,true);
    t.setTextIsSelectable(true);
    GradientDrawable g=new GradientDrawable();g.setColor(Color.rgb(20,10,38));g.setStroke(dp(1),Color.rgb(80,55,120));g.setCornerRadius(dp(12));t.setBackground(g);
    return t;
  }
  void showDeviceInfo(){
    base();
    TextView title=text("MULTIPLAY • MEU DISPOSITIVO",22,true);title.setTextColor(Color.rgb(35,220,255));root.addView(title,new LinearLayout.LayoutParams(-1,dp(60)));
    TextView intro=text("Use estes dados para cadastrar este aparelho no painel Multiplay.",13,false);intro.setTextColor(Color.rgb(200,195,215));root.addView(intro);
    TextView idBox=infoValue("DEVICE ID — identificador usado pelo Multiplay",deviceId);root.addView(idBox,new LinearLayout.LayoutParams(-1,dp(78)));
    Button copyId=copyButton("📋 COPIAR DEVICE ID",deviceId);root.addView(copyId,new LinearLayout.LayoutParams(-1,dp(48)));
    TextView keyBox=infoValue("DEVICE KEY — chave deste aparelho",deviceKey);root.addView(keyBox,new LinearLayout.LayoutParams(-1,dp(78)));
    Button copyKey=copyButton("📋 COPIAR DEVICE KEY",deviceKey);root.addView(copyKey,new LinearLayout.LayoutParams(-1,dp(48)));
    Button copyAll=copyButton("📋 COPIAR ID + KEY", "Device ID: "+deviceId+"\nDevice Key: "+deviceKey);root.addView(copyAll,new LinearLayout.LayoutParams(-1,dp(48)));
    TextView macInfo=text("MAC físico do Wi‑Fi: não disponível para apps comuns no Android 13.\nO Multiplay usa o Device ID acima como identificador do aparelho.",12,false);macInfo.setTextColor(Color.rgb(170,155,190));root.addView(macInfo,new LinearLayout.LayoutParams(-1,dp(62)));
    Button open=button("🌐 ABRIR PAINEL MULTIPLAY");root.addView(open,new LinearLayout.LayoutParams(-1,dp(50)));open.setOnClickListener(v->startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(PANEL))));
    Button update=button("↻ ATUALIZAR PLAYLIST");root.addView(update,new LinearLayout.LayoutParams(-1,dp(50)));update.setOnClickListener(v->sync());
    Button back=button("← VOLTAR À MULTIPLAY");root.addView(back,new LinearLayout.LayoutParams(-1,dp(50)));back.setOnClickListener(v->home("Pronto. Toque em Atualizar para sincronizar a playlist."));
  }
  void continueWatching(){
    android.content.SharedPreferences p=getSharedPreferences("multiplay",0);String u=p.getString("last_url",""),n=p.getString("last_name","");
    if(u.isEmpty()){Toast.makeText(this,"Ainda não há conteúdo para continuar.",Toast.LENGTH_SHORT).show();return;}
    play(new Item(n.isEmpty()?"Continuar assistindo":n,u,"",""));
  }
  void sync(){
    Toast.makeText(this,"Atualizando biblioteca Multiplay...",Toast.LENGTH_SHORT).show();
    new Thread(()->{
      try{
        String status=get("/api/device/status?device_id="+enc(deviceId)+"&device_key="+enc(deviceKey));
        if(!jsonBool(status,"registered")){postRegister(); status=get("/api/device/status?device_id="+enc(deviceId)+"&device_key="+enc(deviceKey));}
        if(!jsonBool(status,"active")){runOnUiThread(()->home("Sua conta precisa ser ativada para carregar a playlist."));return;}
        if(!jsonBool(status,"has_playlist")){runOnUiThread(()->{home("Nenhuma playlist vinculada. Abra MEU DISPOSITIVO para copiar ID + KEY.");new Handler(Looper.getMainLooper()).postDelayed(()->showDeviceInfo(),350);});return;}
        String data=get("/api/device/playlist?device_id="+enc(deviceId)+"&device_key="+enc(deviceKey));
        String url=json(data,"playlist_url");playlistName=json(data,"playlist_name");
        if(url==null||url.isEmpty()){runOnUiThread(()->home("Playlist não encontrada. Toque em Atualizar novamente."));return;}
        String m3u="";
        try {
          m3u=getRaw("/api/device/playlist/content?device_id="+enc(deviceId)+"&device_key="+enc(deviceKey));
        } catch(Exception proxyError) {
          // Se o proxy retornar 404/502, tenta a M3U autorizada diretamente.
          m3u=getAbsolute(url);
        }
        parseM3U(m3u);
        if(items.isEmpty()) {
          m3u=getAbsolute(url);
          parseM3U(m3u);
        }
        if(items.isEmpty()) throw new IOException("A playlist foi encontrada, mas não contém entradas M3U válidas.");
        runOnUiThread(()->home("Playlist sincronizada: "+(playlistName.isEmpty()?"Multiplay":playlistName)+" • "+items.size()+" conteúdos"));
      }catch(Exception e){String msg=e.getMessage();if(msg==null||msg.isEmpty())msg="erro de conexão";String finalMsg=msg;runOnUiThread(()->home("Falha ao atualizar: "+finalMsg+"\nAbra MEU DISPOSITIVO e confira ID + KEY."));}
    }).start();
  }
  void postRegister()throws Exception{
    URL u=new URL(API+"/api/device/register");HttpURLConnection c=(HttpURLConnection)u.openConnection();c.setRequestMethod("POST");c.setDoOutput(true);c.setConnectTimeout(15000);c.setReadTimeout(15000);c.setRequestProperty("Content-Type","application/json");
    String body="{\"device_id\":\""+deviceId+"\",\"device_key\":\""+deviceKey+"\"}";c.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));c.getInputStream().close();
  }
  String getRaw(String path)throws Exception{URL u=new URL(API+path);HttpURLConnection c=(HttpURLConnection)u.openConnection();c.setRequestMethod("GET");c.setConnectTimeout(15000);c.setReadTimeout(90000);c.setRequestProperty("Accept","application/x-mpegURL,audio/x-mpegurl,text/plain,*/*");int code=c.getResponseCode();InputStream in=code>=400?c.getErrorStream():c.getInputStream();if(in==null)throw new IOException("HTTP "+code);BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));StringBuilder s=new StringBuilder();String l;while((l=r.readLine())!=null)s.append(l).append("\n");r.close();if(code>=400)throw new IOException("HTTP "+code);return s.toString();}
  String get(String path)throws Exception{URL u=new URL(API+path);HttpURLConnection c=(HttpURLConnection)u.openConnection();c.setRequestMethod("GET");c.setConnectTimeout(15000);c.setReadTimeout(60000);InputStream in=c.getResponseCode()>=400?c.getErrorStream():c.getInputStream();if(in==null)throw new IOException("HTTP");BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));StringBuilder s=new StringBuilder();String l;while((l=r.readLine())!=null)s.append(l);r.close();return s.toString();}
  String getAbsolute(String url)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(15000);c.setReadTimeout(90000);c.setRequestProperty("User-Agent","Multiplay/2.0.2");c.setRequestProperty("Accept","application/x-mpegURL,audio/x-mpegurl,text/plain,*/*");int code=c.getResponseCode();InputStream in=code>=400?c.getErrorStream():c.getInputStream();if(in==null)throw new IOException("HTTP "+code);BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();String l;while((l=r.readLine())!=null)out.append(l).append("\n");r.close();if(code>=400)throw new IOException("Playlist HTTP "+code);return out.toString();}
  String enc(String s)throws Exception{return URLEncoder.encode(s,"UTF-8");}
  boolean jsonBool(String j,String key){Matcher m=Pattern.compile("\""+Pattern.quote(key)+"\"\\s*:\\s*(true|false)",Pattern.CASE_INSENSITIVE).matcher(j);return m.find()&&"true".equalsIgnoreCase(m.group(1));}
  String json(String j,String key){Matcher m=Pattern.compile("\""+Pattern.quote(key)+"\"\\s*:\\s*\"([^\"]*)\"").matcher(j);return m.find()?m.group(1).replace("\\\"","\""):null;}
  void parseM3U(String m3u){
    items.clear();String n=null,g="",l="";
    if(m3u==null)m3u="";
    m3u=m3u.replace("\uFEFF","").replace("\r","");
    for(String raw:m3u.split("\\n")){String line=raw.trim();
      if(line.toUpperCase(Locale.ROOT).startsWith("#EXTINF")){int c=line.indexOf(',');n=c>=0?line.substring(c+1).trim():"Conteúdo";g=attr(line,"group-title");l=attr(line,"tvg-logo");}
      else if(!line.isEmpty()&&!line.startsWith("#")&&n!=null){items.add(new Item(n,line,g,l));n=null;g="";l="";}
    }
  }
  String attr(String line,String key){Matcher m=Pattern.compile(key+"=\"([^\"]*)\"",Pattern.CASE_INSENSITIVE).matcher(line);return m.find()?m.group(1):"";}
  String kind(Item x){String s=(x.group+" "+x.name).toLowerCase(Locale.ROOT);if(s.matches(".*(filme|movie|vod|cinema|film).*"))return "FILMES";if(s.matches(".*(série|serie|series|season|temporada|epis[oó]dio).*"))return "SÉRIES";return "TV AO VIVO";}
  void showList(String filter,String query){
    currentFilter=filter;if(listBox==null)return;listBox.removeAllViews();String qq=query.toLowerCase(Locale.ROOT);int count=0;
    for(Item x:items){String k=kind(x);if(!filter.equals("TODOS")&&!k.equals(filter))continue;if(!qq.isEmpty()&&!x.name.toLowerCase(Locale.ROOT).contains(qq)&&!x.group.toLowerCase(Locale.ROOT).contains(qq))continue;
      TextView b=pill((k.equals("TV AO VIVO")?"📺 ":k.equals("FILMES")?"🎬 ":"🍿 ")+x.name+"\n"+(x.group.isEmpty()?"":x.group));b.setGravity(Gravity.CENTER_VERTICAL);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(62));p.setMargins(0,dp(3),0,dp(3));listBox.addView(b,p);b.setOnClickListener(v->play(x));if(++count>=300)break;
    }
    if(count==0)listBox.addView(text(items.isEmpty()?"Nenhum conteúdo sincronizado.":"Nenhum conteúdo encontrado.",14,false));
  }
  void play(Item x){
    getSharedPreferences("multiplay",0).edit().putString("last_url",x.url).putString("last_name",x.name).apply();
    base();TextView h=text("Multiplay  •  "+x.name,19,true);root.addView(h,new LinearLayout.LayoutParams(-1,dp(55)));
    PlayerView pv=new PlayerView(this);root.addView(pv,new LinearLayout.LayoutParams(-1,0,1));Button back=button("← Voltar à Multiplay");root.addView(back,new LinearLayout.LayoutParams(-1,dp(52)));
    player=new ExoPlayer.Builder(this).build();pv.setPlayer(player);player.setMediaItem(MediaItem.fromUri(Uri.parse(x.url)));player.prepare();player.play();
    back.setOnClickListener(v->{if(player!=null){player.release();player=null;}home("Conteúdo pronto. Toque em CONTINUAR para retomar o último.");});
  }
  @Override protected void onDestroy(){if(player!=null){player.release();player=null;}super.onDestroy();}
}
