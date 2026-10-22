package ca.hsc.skating;

import android.webkit.CookieManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "HSCSession")
public class HSCSessionPlugin extends Plugin {
    @PluginMethod
    public void clearCookies(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            CookieManager manager = CookieManager.getInstance();
            manager.removeAllCookies(removed -> {
                manager.flush();
                call.resolve();
            });
        });
    }
}
