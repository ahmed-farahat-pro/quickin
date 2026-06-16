package com.quickin.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** A single concierge bubble. [id] keeps LazyColumn keys stable across streaming updates. */
data class AiChatMessage(
    val id: Long,
    val role: String,            // "user" | "assistant"
    val content: String
) {
    val isUser: Boolean get() = role == "user"
}

/** UI state for the travel-concierge chat. */
data class AiTravelUiState(
    val messages: List<AiChatMessage> = emptyList(),
    /** True from send until the stream ends (drives the typing dot + disabled input). */
    val isStreaming: Boolean = false,
    /** Set when a send fails; cleared on the next send or an explicit dismiss. */
    val error: String? = null
) {
    /** True before the user has sent anything — drives the greeting + suggestion chips. */
    val isEmpty: Boolean get() = messages.isEmpty()
}

/**
 * Drives the AI **travel concierge** chat. Holds the running transcript and streaming
 * flags; on [send] it appends the user's turn plus an empty assistant turn, then streams
 * tokens from [AITravelChatService] into that last assistant bubble (updating the
 * StateFlow per token). The endpoint is public, so — unlike [ChatViewModel] — there's no
 * token plumbing or auth gate.
 */
class AiTravelViewModel : ViewModel() {

    private val _state = MutableStateFlow(AiTravelUiState())
    val state: StateFlow<AiTravelUiState> = _state.asStateFlow()

    private var nextId = 0L
    private fun newId(): Long = nextId++

    /**
     * Sends [text] as the next user turn and streams the assistant's reply. No-ops on
     * blank input or while a reply is still streaming (the input is disabled then anyway).
     */
    fun send(text: String) {
        val prompt = text.trim()
        if (prompt.isEmpty() || _state.value.isStreaming) return

        val userMsg = AiChatMessage(newId(), "user", prompt)
        val assistantId = newId()
        val assistantMsg = AiChatMessage(assistantId, "assistant", "")

        // History sent to the model: everything so far + this user turn (NOT the empty
        // assistant placeholder we add for the UI).
        val history = _state.value.messages.map { AiMessage(it.role, it.content) } +
            AiMessage("user", prompt)

        _state.value = _state.value.copy(
            messages = _state.value.messages + userMsg + assistantMsg,
            isStreaming = true,
            error = null
        )

        viewModelScope.launch {
            try {
                AITravelChatService.stream(history) { delta ->
                    appendToAssistant(assistantId, delta)
                }
                _state.value = _state.value.copy(isStreaming = false)
            } catch (e: Exception) {
                // Drop the empty assistant bubble and surface the error for retry.
                _state.value = _state.value.copy(
                    messages = _state.value.messages.filterNot {
                        it.id == assistantId && it.content.isBlank()
                    },
                    isStreaming = false,
                    error = e.message ?: "AI isn't available right now."
                )
            }
        }
    }

    /** Re-sends the last user message (used by the inline error's Retry). */
    fun retry() {
        if (_state.value.isStreaming) return
        val lastUser = _state.value.messages.lastOrNull { it.isUser } ?: return
        // Drop everything from that user turn onward, then resend it cleanly.
        val idx = _state.value.messages.indexOfLast { it.id == lastUser.id }
        _state.value = _state.value.copy(
            messages = _state.value.messages.subList(0, idx),
            error = null
        )
        send(lastUser.content)
    }

    fun clearError() {
        if (_state.value.error != null) _state.value = _state.value.copy(error = null)
    }

    /**
     * Appends a streamed [delta] to the assistant bubble [id]. Called from the service's
     * IO thread, but MutableStateFlow is thread-safe and Compose collects on the main
     * thread, so a direct `value` update is safe — no dispatcher hop needed.
     */
    private fun appendToAssistant(id: Long, delta: String) {
        _state.value = _state.value.copy(
            messages = _state.value.messages.map { msg ->
                if (msg.id == id) msg.copy(content = msg.content + delta) else msg
            }
        )
    }
}
