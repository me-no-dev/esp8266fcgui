#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include <ArduinoOTA.h>
#include <ESP8266NetBIOS.h>
#include <ESP8266SSDP.h>
#include <DNSServer.h>
#include <FS.h>
#include <ESPAsyncWebServer.h>
#include <StreamString.h>
#include "lwip/inet.h"
#include "fc_config.h"

//Home WiFi Settings
const char* sta_ssid = STA_SSID;
const char* sta_password = STA_PASSWORD;

//Hostname, AP SSID
const char * hostName = AP_SSID;

//AP Password
const char * passWord = AP_PASSWORD;

//SSDP properties
const char * modelName = "ESP8266EX";
const char * modelNumber = "929000226503";

static const char* ssdpTemplate =
  "<?xml version=\"1.0\"?>"
  "<root xmlns=\"urn:schemas-upnp-org:device-1-0\">"
    "<specVersion>"
      "<major>1</major>"
      "<minor>0</minor>"
    "</specVersion>"
    "<URLBase>http://%u.%u.%u.%u/</URLBase>"
    "<device>"
      "<deviceType>upnp:rootdevice</deviceType>"
      "<friendlyName>%s</friendlyName>"
      "<presentationURL>index.html</presentationURL>"
      "<serialNumber>%u</serialNumber>"
      "<modelName>%s</modelName>"
      "<modelNumber>%s</modelNumber>"
      "<modelURL>http://www.espressif.com</modelURL>"
      "<manufacturer>Espressif Systems</manufacturer>"
      "<manufacturerURL>http://www.espressif.com</manufacturerURL>"
      "<UDN>uuid:38323636-4558-4dda-9188-cda0e6%02x%02x%02x</UDN>"
    "</device>"
  "</root>\r\n"
  "\r\n";

DNSServer dnsServer;

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

AsyncWebServer server2(81);//compatibility
AsyncWebSocket ws2("/");

void handleWebSocket(AsyncWebSocket * server, AsyncWebSocketClient * client, AwsEventType type, void * arg, uint8_t *data, size_t len){
  if(type == WS_EVT_DATA){
    AwsFrameInfo * info = (AwsFrameInfo*)arg;
    for(size_t i=0; i < info->len; i++) {
      Serial.write(data[i]);
    }
  }
}

void setup(){
  Serial.begin(115200);
  Serial.setDebugOutput(false);

  WiFi.mode(WIFI_OFF);
  WiFi.softAP(hostName, passWord);
  WiFi.softAPConfig(IPAddress(192,168,4,1),IPAddress(192,168,4,1),IPAddress(255,255,255,0));
  if(sta_ssid){
    WiFi.hostname(hostName);
    WiFi.begin(sta_ssid, sta_password);
    WiFi.waitForConnectResult();
  }

  dnsServer.start(53, "*", WiFi.softAPIP());
  
  MDNS.addService("http","tcp",80);
  
  ArduinoOTA.setHostname(hostName);
  ArduinoOTA.begin();
  
  NBNS.begin(hostName);

  SSDP.setSchemaURL("description.xml");
  SSDP.setHTTPPort(80);
  SSDP.setDeviceType("upnp:rootdevice");
  SSDP.setModelName(modelName);
  SSDP.setModelNumber(modelNumber);
  SSDP.begin();

  server.on("/description.xml", HTTP_GET, [](AsyncWebServerRequest *request){
      StreamString output;
      if(output.reserve(1024)){
        uint32_t ip = WiFi.localIP();
        uint32_t chipId = ESP.getChipId();
        output.printf(ssdpTemplate,
          IP2STR(&ip),
          hostName,
          chipId,
          modelName,
          modelNumber,
          (uint8_t) ((chipId >> 16) & 0xff),
          (uint8_t) ((chipId >>  8) & 0xff),
          (uint8_t)   chipId        & 0xff
        );
        request->send(200, "text/xml", (String)output);
      } else {
        request->send(500);
      }
  });
  
  SPIFFS.begin();
  
  ws.onEvent(&handleWebSocket);
  server.addHandler(&ws);
  
  server.on("/favicon.ico", HTTP_GET, [](AsyncWebServerRequest *request){
    AsyncWebServerResponse *response = request->beginResponse_P(200, "image/x-icon", favicon_ico_gz, favicon_ico_gz_len);
    response->addHeader("Content-Encoding", "gzip");
    request->send(response);
  });
  server.serveStatic("/", SPIFFS, "/").setDefaultFile("index.html");
  server.begin();
  
  //compatibility
  ws2.onEvent(&handleWebSocket);
  server2.addHandler(&ws2);
  server2.begin();
}

void loop(){
  static char serialBuf[1441];
  static size_t bufLen = 0;
  ArduinoOTA.handle();
  dnsServer.processNextRequest();
  if(Serial.available()){
    while(Serial.available() && bufLen < 1440){
      serialBuf[bufLen++] = Serial.read();
      if(!Serial.available() && bufLen < 1440){
        delay(1);//wait a bit more
      }
    }
    serialBuf[bufLen] = 0;
    ws.binaryAll(serialBuf, bufLen);
    ws2.binaryAll(serialBuf, bufLen);
    bufLen = 0;
  }
}
