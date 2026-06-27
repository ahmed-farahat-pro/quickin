package com.quickin.app.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink

/**
 * Full-screen Paymob HOSTED checkout, rendered in an in-app [WebView]. The user enters their card
 * details on Paymob's own page — we never collect card data in our UI.
 *
 * The WebView loads [checkoutUrl]. As soon as it navigates to any URL that starts with
 * [returnUrlPrefix] (our `/api/paymob/return` page), the payment leg is finished: we stop the load
 * and invoke [onFinished] once. The host then closes this screen and polls the booking for the
 * webhook-driven paid state. The top-bar back button (and system Back, wired by the caller) calls
 * [onCancel] — treated as a cancellation with no charge.
 *
 * A [LinearProgressIndicator] shows while a page is loading.
 *
 * @param checkoutUrl the Paymob hosted-checkout URL from `pay-init`.
 * @param returnUrlPrefix our return-page prefix; reaching it means checkout is done.
 * @param onFinished invoked once when the WebView reaches [returnUrlPrefix].
 * @param onCancel invoked when the user backs out before finishing (no charge).
 */
@OptIn(ExperimentalMaterial3Api::class)
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PaymobCheckoutScreen(
    checkoutUrl: String,
    returnUrlPrefix: String,
    onFinished: () -> Unit,
    onCancel: () -> Unit
) {
    // Keep the latest callbacks/prefix without re-creating the WebViewClient on recomposition.
    val currentOnFinished by rememberUpdatedState(onFinished)
    val currentPrefix by rememberUpdatedState(returnUrlPrefix)
    var loading by remember { mutableStateOf(true) }
    // Guard so we invoke onFinished exactly once even if several navigations match the prefix.
    val finished = remember { booleanArrayOf(false) }

    fun handleUrl(url: String?): Boolean {
        val prefix = currentPrefix
        if (!url.isNullOrEmpty() && prefix.isNotEmpty() && url.startsWith(prefix)) {
            if (!finished[0]) {
                finished[0] = true
                currentOnFinished()
            }
            return true
        }
        return false
    }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        stringResource(R.string.paymob_title),
                        color = Ink,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onCancel) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_cancel),
                            tint = Ink
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = CreamPage,
                    titleContentColor = Ink
                )
            )
        }
    ) { inner ->
        Box(modifier = Modifier.fillMaxSize().padding(inner)) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.loadWithOverviewMode = true
                        settings.useWideViewPort = true
                        // Paymob's hosted page is its own origin; in-app navigation should stay in
                        // this WebView (and we intercept our return URL ourselves).
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(
                                view: WebView?,
                                request: WebResourceRequest?
                            ): Boolean {
                                val url = request?.url?.toString()
                                if (handleUrl(url)) {
                                    view?.stopLoading()
                                    return true
                                }
                                return false
                            }

                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                loading = true
                                if (handleUrl(url)) {
                                    view?.stopLoading()
                                    return
                                }
                                super.onPageStarted(view, url, favicon)
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                loading = false
                                super.onPageFinished(view, url)
                            }
                        }
                        loadUrl(checkoutUrl)
                    }
                }
            )

            if (loading) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth().height(3.dp),
                    color = Burgundy,
                    trackColor = Color.Transparent
                )
            }
        }
    }
}
