package com.jarvis.feature.capture.api

const val CAPTURE_ROUTE = "capture"

fun CaptureNavController.navigateToCapture() {
    navigate(CAPTURE_ROUTE)
}

interface CaptureNavController {
    fun navigate(route: String)
}
