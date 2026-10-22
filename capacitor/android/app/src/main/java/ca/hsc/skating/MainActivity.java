package ca.hsc.skating;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HSCSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
