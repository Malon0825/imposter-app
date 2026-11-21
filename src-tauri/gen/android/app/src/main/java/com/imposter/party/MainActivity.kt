package com.imposter.party

import android.os.Bundle
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
      navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT)
    )
    super.onCreate(savedInstanceState)
    window.setBackgroundDrawable(ColorDrawable(Color.rgb(20, 25, 22)))
    val content = findViewById<View>(android.R.id.content)
    val handled = WindowInsetsCompat.Type.systemBars() or
      WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val padding = insets.getInsets(handled)
      view.setPadding(padding.left, padding.top, padding.right, padding.bottom)
      // The WebView already fits inside these insets. Still dispatch changes when they clear.
      WindowInsetsCompat.Builder(insets).setInsets(handled, Insets.NONE).build()
    }
    ViewCompat.requestApplyInsets(content)
  }
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    fun findWebView(view: View): WebView? {
      if (view is WebView) return view
      if (view is ViewGroup) for (i in 0 until view.childCount) {
        val found = findWebView(view.getChildAt(i))
        if (found != null) return found
      }
      return null
    }
    findViewById<View>(android.R.id.content).post {
      findWebView(findViewById(android.R.id.content))?.evaluateJavascript("window.dispatchEvent(new Event('imposter-invitation'))", null)
    }
  }
}
