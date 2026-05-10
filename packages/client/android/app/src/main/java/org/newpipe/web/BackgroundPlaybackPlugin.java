package org.newpipe.web;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin that manages the BackgroundPlaybackService.
 * Exposes start/stop/updateMetadata methods to the WebView JS layer.
 */
@CapacitorPlugin(name = "BackgroundPlayback")
public class BackgroundPlaybackPlugin extends Plugin {

    @PluginMethod()
    public void start(PluginCall call) {
        String title = call.getString("title", "Flowpipe");
        String artist = call.getString("artist", "");

        Intent intent = new Intent(getContext(), BackgroundPlaybackService.class);
        BackgroundPlaybackService.currentTitle = title;
        BackgroundPlaybackService.currentArtist = artist;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        call.resolve();
    }

    @PluginMethod()
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), BackgroundPlaybackService.class);
        intent.setAction("STOP");
        getContext().startService(intent);

        call.resolve();
    }

    @PluginMethod()
    public void updateMetadata(PluginCall call) {
        String title = call.getString("title");
        String artist = call.getString("artist");

        Intent intent = new Intent(getContext(), BackgroundPlaybackService.class);
        intent.setAction("UPDATE_METADATA");
        if (title != null) intent.putExtra("title", title);
        if (artist != null) intent.putExtra("artist", artist);
        getContext().startService(intent);

        call.resolve();
    }
}
