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
    private static final String GEMINI_MODEL = System.getenv("GEMINI_MODEL") != null ? 
            System.getenv("GEMINI_MODEL") : "gemini-2.5-flash-lite"; // Defaulting to the latest requested lite model
    private static final OkHttpClient client = new OkHttpClient();

    public static void main(String[] args) throws Exception {
        if (args.length > 0 && args[0].equalsIgnoreCase("list")) {
            listModels();
            return;
        }
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
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");

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

                    String prompt = "You are a HIGHLY STRICT content auditor for PW (Physics Wallah)." +
                            " Audit the following notes for JEE/NEET standards. " +
                            " IMPORTANT: If the notes are gibberish, irrelevant, or non-educational, " +
                            " set ALL scores to 0 and list 'Invalid/Nonsense Content' in top_fixes. " +
                            " Otherwise, audit concepts, questions, and answers strictly. " +
                            " Return ONLY valid JSON, no extra text, in this format: " +
                            " {\"overall_score\": 85," +
                            " \"concept_accuracy\": {\"score\": 90, \"issues\": [\"issue1\"]}," +
                            " \"question_quality\": {\"score\": 80, \"issues\": [\"issue1\"]}," +
                            " \"answer_correctness\": {\"score\": 85, \"issues\": [\"issue1\"]}," +
                            " \"top_fixes\": [\"fix1\", \"fix2\"]}" +
                            " Notes: " + notes;

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
                + "}],"
                + "\"generationConfig\": {"
                + "\"temperature\": 0.0"
                + "}"
                + "}";

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + GEMINI_MODEL + ":generateContent?key=" + API_KEY.trim();

        int maxRetries = 3;
        int retryCount = 0;
        Exception lastException = null;

        while (retryCount < maxRetries) {
            try {
                Request request = new Request.Builder()
                        .url(url)
                        .post(RequestBody.create(requestBody,
                                MediaType.parse("application/json")))
                        .addHeader("content-type", "application/json")
                        .build();

                Response response = client.newCall(request).execute();
                String responseBody = response.body().string();

                JsonObject json = JsonParser.parseString(responseBody).getAsJsonObject();

                if (json.has("error")) {
                    JsonObject error = json.getAsJsonObject("error");
                    int code = error.has("code") ? error.get("code").getAsInt() : 500;
                    if (code == 503 || code == 429) {
                        logger.warn("Gemini is busy (Error " + code + "). Retrying in 2 seconds... (Attempt " + (retryCount + 1) + ")");
                        lastException = new Exception("Gemini is overloaded: " + error.get("message").getAsString());
                        Thread.sleep(2000);
                        retryCount++;
                        continue;
                    }
                    throw new Exception("Gemini API Error: " + error.get("message").getAsString());
                }

                return json.getAsJsonArray("candidates")
                        .get(0).getAsJsonObject()
                        .getAsJsonObject("content")
                        .getAsJsonArray("parts")
                        .get(0).getAsJsonObject()
                        .get("text")
                        .getAsString();

            } catch (Exception e) {
                lastException = e;
                retryCount++;
                if (retryCount < maxRetries) Thread.sleep(2000);
            }
        }
        throw lastException;
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