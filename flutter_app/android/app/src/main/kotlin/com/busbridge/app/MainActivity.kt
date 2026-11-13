package com.busbridge.app

import android.os.Bundle
import com.google.android.gms.maps.MapsInitializer
import com.google.android.gms.maps.MapsApiSettings
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MapsInitializer.initialize(applicationContext, MapsInitializer.Renderer.LATEST, null)
        MapsApiSettings.addInternalUsageAttributionId(
            applicationContext,
            "gmp_mcp_codeassist_v1_aistudio"
        )
    }
}
