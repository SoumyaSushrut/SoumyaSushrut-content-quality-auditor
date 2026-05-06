package com.pw;

import okhttp3.*;
import com.google.gson.*;
import java.io.*;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class QCBot {

    private static final Logger logger = LogManager.getLogger(QCBot.class);

    private static final String API_KEY = System.getenv("GEMINI_API_KEY");
    private static final OkHttpClient client = new OkHttpClient();

    public static void main(String[] args) throws Exception {
        if (API_KEY == null || API_KEY.isEmpty()) {
            logger.error("FATAL ERROR: GEMINI_API_KEY environment variable is not set!");
            logger.error(
                    "Please set it using: setx GEMINI_API_KEY \"your_key_here\" (Windows) or export GEMINI_API_KEY=\"your_key_here\" (Mac/Linux)");
            System.exit(1);
        }
        // Get port from environment variable (required for cloud deployment)
        String portStr = System.getenv("PORT");
        int port = (portStr != null) ? Integer.parseInt(portStr) : 8080;

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/audit", new AuditHandler());
        server.createContext("/", (exchange) -> {
            String response = "OK";
            exchange.sendResponseHeaders(200, response.length());
            OutputStream os = exchange.getResponseBody();
            os.write(response.getBytes());
            os.close();
        });
        server.setExecutor(null);
        server.start();
        logger.info("QC Bot API Server started on port " + port);
        logger.info("Waiting for frontend requests...");

        // Shutdown hook to release resources cleanly
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            logger.info("Shutting down server...");
            server.stop(0);
            logger.info("Server stopped.");
        }));
    }

    static class AuditHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // Handle CORS
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.getResponseBody().close();
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    InputStreamReader isr = new InputStreamReader(exchange.getRequestBody(), StandardCharsets.UTF_8);
                    JsonObject requestBody = JsonParser.parseReader(isr).getAsJsonObject();
                    String notes = requestBody.has("notes") ? requestBody.get("notes").getAsString() : "";

                    logger.info("--- Received new audit request ---");
                    logger.info("Notes loaded! Sending to Gemini...");

                    String prompt = "You are a strict content auditor for PW (Physics Wallah)." +
                            " A teacher has submitted these notes. Audit everything -" +
                            " check if concepts are correct, questions are good, answers are right," +
                            " and language is clear for JEE/NEET students." +
                            " Return ONLY valid JSON, no extra text, no backticks, in this format:" +
                            " {\"overall_score\": 85," +
                            " \"concept_accuracy\": {\"score\": 90, \"issues\": [\"issue1\"]}," +
                            " \"question_quality\": {\"score\": 80, \"issues\": [\"issue1\"]}," +
                            " \"answer_correctness\": {\"score\": 85, \"issues\": [\"issue1\"]}," +
                            " \"top_fixes\": [\"fix1\", \"fix2\"]}" +
                            " Here are the notes to audit: " + notes;

                    String response = callGemini(prompt);
                    logger.info("Gemini replied!");

                    // Clean the response
                    response = response.trim();
                    if (response.startsWith("```")) {
                        response = response.replaceAll("```json", "").replaceAll("```", "").trim();
                    }

                    byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, responseBytes.length);
                    OutputStream os = exchange.getResponseBody();
                    os.write(responseBytes);
                    os.close();

                    logger.info("Audit response sent back to frontend.");

                } catch (Exception e) {
                    logger.error("Error processing audit request", e);
                    String errorMsg = "{\"error\": \"Internal Server Error\"}";
                    exchange.sendResponseHeaders(500, errorMsg.length());
                    OutputStream os = exchange.getResponseBody();
                    os.write(errorMsg.getBytes(StandardCharsets.UTF_8));
                    os.close();
                }
            } else {
                exchange.sendResponseHeaders(405, -1);
            }
        }
    }

    // Sends prompt to Gemini API and returns AI's reply
    static String callGemini(String prompt) throws Exception {

        String requestBody = "{"
                + "\"contents\": [{"
                + "\"parts\": [{"
                + "\"text\": \"" + prompt.replace("\"", "\\\"").replace("\n", "\\n") + "\""
                + "}]"
                + "}]"
                + "}";

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + "gemini-2.5-flash-lite:generateContent?key=" + API_KEY;

        Request request = new Request.Builder()
                .url(url)
                .post(RequestBody.create(requestBody,
                        MediaType.parse("application/json")))
                .addHeader("content-type", "application/json")
                .build();

        Response response = client.newCall(request).execute();
        String responseBody = response.body().string();

        // Print raw response so we can see exactly what Gemini sends back
        logger.debug("RAW RESPONSE: " + responseBody);

        JsonObject json = JsonParser.parseString(responseBody).getAsJsonObject();

        // Check if error exists
        if (json.has("error")) {
            throw new Exception("Gemini API Error: " + json.get("error").toString());
        }

        return json.getAsJsonArray("candidates")
                .get(0).getAsJsonObject()
                .getAsJsonObject("content")
                .getAsJsonArray("parts")
                .get(0).getAsJsonObject()
                .get("text")
                .getAsString();
    }

    static void listModels() throws Exception {

        String url = "https://generativelanguage.googleapis.com/v1beta/models?key=" + API_KEY;

        Request request = new Request.Builder()
                .url(url)
                .get()
                .build();

        Response response = client.newCall(request).execute();
        String responseBody = response.body().string();

        // Parse and print just the model names cleanly
        JsonObject json = JsonParser.parseString(responseBody).getAsJsonObject();
        JsonArray models = json.getAsJsonArray("models");

        System.out.println("\n====== AVAILABLE MODELS ======");
        for (int i = 0; i < models.size(); i++) {
            JsonObject model = models.get(i).getAsJsonObject();
            String name = model.get("name").getAsString();
            System.out.println(name);
        }
        System.out.println("==============================");
    }
}