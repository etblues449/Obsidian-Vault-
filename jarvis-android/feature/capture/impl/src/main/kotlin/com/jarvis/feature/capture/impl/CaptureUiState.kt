package com.jarvis.feature.capture.impl

sealed interface CaptureUiState {
    data object Loading : CaptureUiState
    data class Success(val recentCaptures: List<String>) : CaptureUiState
    data class Error(val message: String) : CaptureUiState
}
