package io.github.nikolai1005.sprunkiveritytd;

import java.io.BufferedReader;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class GameContent {
    private static final int MAX_HTML_BYTES = 24 * 1024 * 1024;
    private static final int NETWORK_TIMEOUT_MS = 4000;
    private static final Object DOWNLOAD_LOCK = new Object();
    private static final Pattern VERSION = Pattern.compile(
            "^\\s*var\\s+VER\\s*=\\s*'([0-9]{1,6})\\.([0-9]{1,3})(?:\\.([0-9]{1,3}))?'");

    private final Path downloaded;
    private final Path validator;
    private final String source;
    private final long bundledVersion;

    GameContent(Path directory, String source, long bundledVersion) {
        downloaded = directory.resolve("downloaded-game.html");
        validator = directory.resolve("downloaded-game.etag");
        this.source = source;
        this.bundledVersion = bundledVersion;
    }

    long currentVersion() {
        try {
            return Math.max(bundledVersion, readVersion(downloaded));
        } catch (IOException invalidOrMissing) {
            return bundledVersion;
        }
    }

    InputStream openDownloaded() {
        try {
            if (readVersion(downloaded) > bundledVersion) {
                return Files.newInputStream(downloaded);
            }
        } catch (IOException invalidOrMissing) {
            // The bundled game is always available through the same WebView origin.
        }
        return null;
    }

    long refresh() throws IOException {
        synchronized (DOWNLOAD_LOCK) {
            long current = currentVersion();
            URL endpoint = new URL(source);
            if (!"https".equals(endpoint.getProtocol())) {
                throw new IOException("The game update URL must use HTTPS");
            }
            HttpURLConnection connection = (HttpURLConnection) endpoint.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(NETWORK_TIMEOUT_MS);
            connection.setReadTimeout(NETWORK_TIMEOUT_MS);
            connection.setUseCaches(false);
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Accept", "text/html");
            connection.setRequestProperty("Accept-Encoding", "identity");
            String etag = readEtag(current);
            if (!etag.isEmpty()) connection.setRequestProperty("If-None-Match", etag);

            Path incoming = null;
            try {
                int status = connection.getResponseCode();
                if (status == HttpURLConnection.HTTP_NOT_MODIFIED) return current;
                if (status != HttpURLConnection.HTTP_OK) {
                    throw new IOException("Game update returned HTTP " + status);
                }
                String responseEtag = connection.getHeaderField("ETag");
                if (!etag.isEmpty() && etag.equals(responseEtag)) return current;
                String type = connection.getContentType();
                long expectedSize = connection.getContentLengthLong();
                if (type == null || !type.split(";", 2)[0].trim().equalsIgnoreCase("text/html")
                        || expectedSize > MAX_HTML_BYTES || expectedSize == 0) {
                    throw new IOException("Unexpected game update response");
                }
                incoming = Files.createTempFile(downloaded.getParent(), "game-update-", ".html");
                download(connection, incoming, expectedSize);
                long next = readVersion(incoming);
                if (next < current) return current;
                if (next > current) {
                    Files.move(incoming, downloaded, StandardCopyOption.ATOMIC_MOVE,
                            StandardCopyOption.REPLACE_EXISTING);
                }
                rememberEtag(next, responseEtag);
                return next;
            } finally {
                connection.disconnect();
                if (incoming != null) Files.deleteIfExists(incoming);
            }
        }
    }

    private static void download(HttpURLConnection connection, Path incoming, long expectedSize)
            throws IOException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(20);
        long size = 0;
        try (InputStream input = connection.getInputStream();
             FileOutputStream output = new FileOutputStream(incoming.toFile())) {
            byte[] buffer = new byte[16 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) {
                size += count;
                if (size > MAX_HTML_BYTES || System.nanoTime() > deadline) {
                    throw new IOException("Game update exceeded the download limit");
                }
                output.write(buffer, 0, count);
            }
            if (expectedSize >= 0 && size != expectedSize) {
                throw new IOException("Incomplete game update");
            }
            output.getFD().sync();
        }
    }

    private static long readVersion(Path html) throws IOException {
        long size = Files.size(html);
        if (size == 0 || size > MAX_HTML_BYTES) throw new IOException("Invalid game file size");
        try (BufferedReader input = Files.newBufferedReader(html, StandardCharsets.UTF_8)) {
            String line = input.readLine();
            if (line == null || !line.startsWith("<!DOCTYPE html")) {
                throw new IOException("Missing game document header");
            }
            boolean gameTitle = false;
            boolean complete = false;
            long version = 0;
            do {
                gameTitle |= line.contains("<title>Sprunki Verity TD</title>");
                String trimmed = line.trim();
                if (!trimmed.isEmpty()) complete = trimmed.endsWith("</html>");
                if (version == 0) {
                    Matcher marker = VERSION.matcher(line);
                    if (marker.find()) {
                        long major = Long.parseLong(marker.group(1));
                        long minor = Long.parseLong(marker.group(2));
                        long patch = marker.group(3) == null ? 0 : Long.parseLong(marker.group(3));
                        version = major * 1_000_000 + minor * 1_000 + patch;
                    }
                }
            } while ((line = input.readLine()) != null);
            if (!gameTitle || !complete || version == 0) {
                throw new IOException("Invalid or incomplete game document");
            }
            return version;
        }
    }

    private String readEtag(long version) {
        try {
            if (Files.size(validator) > 1024) return "";
            List<String> lines = Files.readAllLines(validator, StandardCharsets.UTF_8);
            if (lines.size() == 2 && lines.get(0).equals(Long.toString(version))) {
                return lines.get(1);
            }
        } catch (IOException missingValidator) {
            // Conditional requests are optional.
        }
        return "";
    }

    private void rememberEtag(long version, String etag) {
        try {
            if (etag == null || etag.length() > 512) {
                Files.deleteIfExists(validator);
            } else {
                Files.write(validator, (version + "\n" + etag).getBytes(StandardCharsets.UTF_8));
            }
        } catch (IOException missingValidator) {
            // A valid downloaded game remains usable without its HTTP validator.
        }
    }
}
