package com.imposter.party

import android.os.Bundle
import android.content.Intent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
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
