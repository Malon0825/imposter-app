package com.imposter.party

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.view.WindowManager
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import app.tauri.plugin.JSObject
import app.tauri.PermissionState
import app.tauri.annotation.Command
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.net.Inet4Address

@TauriPlugin(permissions = [
    Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications"),
    Permission(strings = ["android.permission.ACCESS_LOCAL_NETWORK"], alias = "localNetwork")
])
class PartyPlugin(private val activity: Activity) : Plugin(activity) {
    private val connectivity get() = activity.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    @Suppress("DEPRECATION")
    private fun wifiNetwork() = connectivity.allNetworks.firstOrNull {
        connectivity.getNetworkCapabilities(it)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
    }

    override fun load(webView: WebView) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        webView.setBackgroundColor(android.graphics.Color.rgb(20,25,22))
        val owner = activity as ComponentActivity
        owner.onBackPressedDispatcher.addCallback(owner, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("window.dispatchEvent(new Event('imposter-back'))", null)
            }
        })
    }

    private fun information(): JSObject {
        val cm = connectivity
        val active = wifiNetwork()
        val caps = active?.let { cm.getNetworkCapabilities(it) }
        val wifi = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
        val ip = if (wifi) active?.let { cm.getLinkProperties(it) }?.linkAddresses
            ?.firstOrNull { it.address is Inet4Address && it.address.isSiteLocalAddress }?.address?.hostAddress else null
        val power = activity.getSystemService(Context.POWER_SERVICE) as PowerManager
        return JSObject().apply {
            put("platform", "android")
            put("wifi", wifi && ip != null)
            put("wifi_name", "Home Wi-Fi")
            put("ip", ip ?: "")
            put("battery_unrestricted", power.isIgnoringBatteryOptimizations(activity.packageName))
            put("background_supported", true)
        }
    }

    @Command fun status(invoke: Invoke) { invoke.resolve(information()) }

    @Command fun minimize(invoke: Invoke) {
        activity.moveTaskToBack(true)
        invoke.resolve(information())
    }

    @Command fun prepareNetwork(invoke: Invoke) {
        if (Build.VERSION.SDK_INT >= 37 && activity.applicationInfo.targetSdkVersion >= 37 && getPermissionState("localNetwork") != PermissionState.GRANTED) {
            requestPermissionForAlias("localNetwork", invoke, "networkPermissionResult")
            return
        }
        bindWifi(invoke)
    }

    @PermissionCallback fun networkPermissionResult(invoke: Invoke) {
        if (getPermissionState("localNetwork") != PermissionState.GRANTED) invoke.reject("Local network access is needed to join this party. Enable it in app settings.")
        else bindWifi(invoke)
    }

    private fun bindWifi(invoke: Invoke) {
        val result = information()
        if (!result.getBoolean("wifi")) { invoke.reject("Connect to the same router's Wi-Fi first."); return }
        // Explicitly keep LAN traffic on Wi-Fi when that network has no internet.
        if (!connectivity.bindProcessToNetwork(wifiNetwork())) { invoke.reject("Could not use this Wi-Fi network. Reconnect and try again."); return }
        invoke.resolve(result)
    }

    @Command fun wifiSettings(invoke: Invoke) {
        activity.startActivity(Intent(if (Build.VERSION.SDK_INT >= 29) Settings.Panel.ACTION_WIFI else Settings.ACTION_WIFI_SETTINGS))
        invoke.resolve(information())
    }

    @Command fun batterySettings(invoke: Invoke) {
        // Settings guidance rather than requesting a restricted direct Doze exemption.
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${activity.packageName}"))
        activity.startActivity(intent)
        invoke.resolve(information())
    }

    @Command fun startHosting(invoke: Invoke) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", invoke, "notificationPermissionResult")
            return
        }
        beginHosting(invoke)
    }

    @PermissionCallback fun notificationPermissionResult(invoke: Invoke) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) invoke.reject("Allow the hosting notification, or choose Keep app open instead.")
        else beginHosting(invoke)
    }

    private fun beginHosting(invoke: Invoke) {
        try {
            val result = information()
            if (!result.getBoolean("wifi")) { invoke.reject("Connect to the shared Wi-Fi before hosting."); return }
            activity.startForegroundService(Intent(activity, HostService::class.java))
            invoke.resolve(result)
        } catch (error: Exception) { invoke.reject("Background hosting could not start. Keep the app open instead: ${error.message}") }
    }

    @Command fun stopHosting(invoke: Invoke) {
        activity.stopService(Intent(activity, HostService::class.java))
        connectivity.bindProcessToNetwork(null)
        invoke.resolve(information())
    }

    @Command fun secureScreen(invoke: Invoke) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        invoke.resolve(information())
    }
}
