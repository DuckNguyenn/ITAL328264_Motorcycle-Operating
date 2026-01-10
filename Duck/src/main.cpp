#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// 1. CẤU HÌNH WIFI & MQTT
const char* ssid = "Wokwi-GUEST";
const char* password = "";

const char* mqtt_server = "2694844bdff04a26b4afe749bb37db5a.s1.eu.hivemq.cloud";
const int mqtt_port = 8883; // ESP32 dùng cổng 8883 (SSL)
const char* mqtt_user = "DucTTIoT";
const char* mqtt_pass = "123456789aA";
const char* mqtt_topic = "motor/phuong/telemetry";

WiFiClientSecure espClient;
PubSubClient client(espClient);

const int PIN_SPEED = 34; 
const int PIN_TILT = 35;  
const int PIN_TEMP = 32;  

unsigned long lastMsg = 0;
const long interval = 1000; // Gửi 1 giây/lần

void setup() {
  Serial.begin(115200);
  
  WiFi.begin(ssid, password);
  Serial.print("Dang ket noi WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Connected!");

  espClient.setInsecure(); // Bỏ qua check chứng chỉ để chạy nhanh trên Sim
  client.setServer(mqtt_server, mqtt_port);
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Dang ket noi MQTT...");
    String clientId = "ESP32_Sim_" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("✅ Da ket noi HiveMQ!");
    } else {
      Serial.print("Loi ket noi, rc=");
      Serial.print(client.state());
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop(); // Giữ kết nối MQTT
  unsigned long now = millis();
  if (now - lastMsg > interval) {
    lastMsg = now;

    // Đọc cảm biến
    int valSpeed = analogRead(PIN_SPEED);
    int valTilt = analogRead(PIN_TILT);
    int valTemp = analogRead(PIN_TEMP);

    int speed = map(valSpeed, 0, 4095, 0, 140); 
    int tilt = map(valTilt, 0, 4095, 0, 60);    
    int temp = map(valTemp, 0, 4095, 40, 130);  

    StaticJsonDocument<256> doc;
    doc["speed"] = speed;
    doc["tilt"] = tilt;
    doc["temp"] = temp;
    doc["lat"] = 10.8506; 
    doc["lng"] = 106.7719; 

    char jsonBuffer[512];
    serializeJson(doc, jsonBuffer);

    Serial.print("Gui tin: ");
    Serial.println(jsonBuffer);
    client.publish(mqtt_topic, jsonBuffer);
  }
}