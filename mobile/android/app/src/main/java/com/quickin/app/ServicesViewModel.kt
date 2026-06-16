package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** State for the "Services" browse tab list (`GET /api/local/services`). */
data class ServicesUiState(
    val isLoading: Boolean = false,
    val services: List<Service> = emptyList(),
    val error: String? = null,
    val loaded: Boolean = false
)

/** State for a single subscribe action on the service detail screen. */
data class SubscribeUiState(
    val isSubmitting: Boolean = false,
    val error: String? = null,
    /** Set on a 201; carries the just-created (pending) request for the success dialog. */
    val confirmed: ServiceRequest? = null,
    /** True when the user tried to subscribe while signed out. */
    val needsSignIn: Boolean = false
)

/** State for the "My subscriptions" list (`GET /api/local/service-requests`). */
data class MySubscriptionsUiState(
    val isLoading: Boolean = false,
    val requests: List<ServiceRequest> = emptyList(),
    val error: String? = null,
    val loaded: Boolean = false
)

/** State for the host's "Services" + service-request inbox (host-only GET endpoints). */
data class HostServicesUiState(
    val isLoading: Boolean = false,
    val services: List<Service> = emptyList(),
    val requests: List<ServiceRequest> = emptyList(),
    val error: String? = null,
    val loaded: Boolean = false,
    /** Id of the request currently being confirmed/rejected (drives a per-row spinner). */
    val actingOn: String? = null,
    /** Set after a successful confirm/reject, e.g. "Request confirmed". */
    val actionMessage: String? = null
)

/** State for the host "Add service" form (`POST /api/local/services`). */
data class CreateServiceUiState(
    val isSubmitting: Boolean = false,
    val error: String? = null,
    /** Set on a 201; carries the created service so the form can show success. */
    val created: Service? = null
)

/**
 * Owns everything for the Services feature, mirroring [BookingsViewModel] +
 * [HostViewModel]:
 *  • the public browse feed,
 *  • the subscribe mutation (service detail) with a branded confirmation,
 *  • the user's "My subscriptions" list,
 *  • the host's services + request inbox (with Accept / Reject), and
 *  • the host "Add service" form.
 *
 * Reads the bearer token directly from SharedPreferences ("qk_auth" / "token") — the
 * same store the other view models use — so it works without plumbing the token through
 * composables.
 */
class ServicesViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val _services = MutableStateFlow(ServicesUiState())
    val services: StateFlow<ServicesUiState> = _services.asStateFlow()

    private val _subscribe = MutableStateFlow(SubscribeUiState())
    val subscribe: StateFlow<SubscribeUiState> = _subscribe.asStateFlow()

    private val _mySubs = MutableStateFlow(MySubscriptionsUiState())
    val mySubscriptions: StateFlow<MySubscriptionsUiState> = _mySubs.asStateFlow()

    private val _host = MutableStateFlow(HostServicesUiState())
    val host: StateFlow<HostServicesUiState> = _host.asStateFlow()

    private val _create = MutableStateFlow(CreateServiceUiState())
    val create: StateFlow<CreateServiceUiState> = _create.asStateFlow()

    // A service fetched for an incoming deep link (https://…/services/{id} or quickin://services/{id}).
    // MainApp observes this and opens the detail; null once consumed (or when the fetch failed).
    private val _deepLinkService = MutableStateFlow<Service?>(null)
    val deepLinkService: StateFlow<Service?> = _deepLinkService.asStateFlow()

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    init {
        loadServices()
    }

    /**
     * Resolves a deep-linked service by id (`GET /api/local/services/:id`) and publishes it on
     * [deepLinkService] for the UI to open. A fetch failure is silently ignored so a garbage link
     * just leaves the app where it was.
     */
    fun openServiceById(id: String) {
        if (id.isBlank()) return
        viewModelScope.launch {
            runCatching { ServiceService.fetchService(id) }.getOrNull()?.let {
                _deepLinkService.value = it
            }
        }
    }

    /** Consumed by the UI once the deep-linked service has been opened. */
    fun clearDeepLinkService() {
        _deepLinkService.value = null
    }

    // ---- Browse (public) ------------------------------------------------------

    /** Loads the public services feed. No auth required. */
    fun loadServices() {
        _services.value = _services.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val list = ServiceService.fetchServices()
                _services.value = ServicesUiState(
                    isLoading = false,
                    services = list,
                    loaded = true,
                    error = if (list.isEmpty()) "No services yet. Check back soon." else null
                )
            } catch (e: Exception) {
                _services.value = ServicesUiState(
                    isLoading = false,
                    loaded = true,
                    error = e.message ?: "Could not load services."
                )
            }
        }
    }

    // ---- Subscribe (user) -----------------------------------------------------

    /**
     * Subscribes to [serviceId]. Surfaces:
     *  • needsSignIn = true when no token (and on a 401 from the server),
     *  • error = {message} on a 400,
     *  • confirmed = request on 201.
     */
    fun subscribe(serviceId: String, note: String? = null) {
        if (_subscribe.value.isSubmitting) return

        val token = token()
        if (token == null) {
            _subscribe.value = SubscribeUiState(needsSignIn = true)
            return
        }

        _subscribe.value = SubscribeUiState(isSubmitting = true)
        viewModelScope.launch {
            try {
                val request = ServiceService.subscribe(token, serviceId, note)
                _subscribe.value = SubscribeUiState(confirmed = request)
                // Keep the My-subscriptions list fresh for the next visit.
                loadMySubscriptions()
            } catch (e: ServiceService.HttpError) {
                if (e.code == 401) {
                    _subscribe.value = SubscribeUiState(needsSignIn = true)
                } else {
                    _subscribe.value = SubscribeUiState(error = e.message ?: "Could not subscribe.")
                }
            } catch (e: Exception) {
                _subscribe.value = SubscribeUiState(error = e.message ?: "Could not subscribe.")
            }
        }
    }

    /** Resets the subscribe panel (after dismissing a success/error, or when leaving the screen). */
    fun resetSubscribe() {
        _subscribe.value = SubscribeUiState()
    }

    // ---- My subscriptions (user) ----------------------------------------------

    /** Loads the signed-in user's subscriptions. No-op (with a friendly state) when signed out. */
    fun loadMySubscriptions() {
        val token = token()
        if (token == null) {
            _mySubs.value = MySubscriptionsUiState(loaded = true)
            return
        }
        _mySubs.value = _mySubs.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val list = ServiceService.myServiceRequests(token)
                _mySubs.value = MySubscriptionsUiState(
                    isLoading = false,
                    requests = list,
                    loaded = true
                )
            } catch (e: Exception) {
                _mySubs.value = MySubscriptionsUiState(
                    isLoading = false,
                    loaded = true,
                    error = e.message ?: "Could not load your subscriptions."
                )
            }
        }
    }

    /** Clears subscription state on logout so a new user doesn't see stale data. */
    fun clearMySubscriptions() {
        _mySubs.value = MySubscriptionsUiState()
    }

    // ---- Host: services + inbox -----------------------------------------------

    /** Loads the host's own services and their request inbox together. */
    fun loadHost() {
        val token = token() ?: run {
            _host.value = HostServicesUiState(loaded = true, error = "Please sign in.")
            return
        }
        _host.value = _host.value.copy(isLoading = true, error = null, actionMessage = null)
        viewModelScope.launch {
            try {
                val services = ServiceService.hostServices(token)
                val requests = ServiceService.hostServiceRequests(token)
                _host.value = HostServicesUiState(
                    services = services,
                    requests = requests,
                    loaded = true
                )
            } catch (e: Exception) {
                _host.value = HostServicesUiState(
                    loaded = true,
                    error = e.message ?: "Could not load your services."
                )
            }
        }
    }

    /**
     * Confirms or rejects a pending subscription. [action] must be "confirm" or "reject"
     * (the PATCH body's `status`). Updates the row in place on success.
     */
    fun act(requestId: String, action: String) {
        if (_host.value.actingOn != null) return
        val token = token() ?: return
        _host.value = _host.value.copy(actingOn = requestId, error = null, actionMessage = null)
        viewModelScope.launch {
            try {
                val updated = ServiceService.setRequestStatus(token, requestId, action)
                val merged = _host.value.requests.map { if (it.id == updated.id) updated else it }
                _host.value = _host.value.copy(
                    requests = merged,
                    actingOn = null,
                    actionMessage = if (action == "confirm") "Request confirmed" else "Request rejected"
                )
            } catch (e: Exception) {
                _host.value = _host.value.copy(
                    actingOn = null,
                    error = e.message ?: "Couldn't update the request."
                )
            }
        }
    }

    // ---- Host: add service ----------------------------------------------------

    /** Creates a service as the signed-in host. Price is parsed leniently (default 0). */
    fun createService(
        title: String,
        category: String,
        description: String,
        location: String,
        price: String,
        imageUrl: String,
        lat: Double? = null,
        lng: Double? = null
    ) {
        if (_create.value.isSubmitting) return
        val token = token() ?: run {
            _create.value = CreateServiceUiState(error = "Please sign in as a host.")
            return
        }
        if (title.isBlank()) {
            _create.value = CreateServiceUiState(error = "Title is required.")
            return
        }
        _create.value = CreateServiceUiState(isSubmitting = true)
        viewModelScope.launch {
            try {
                val service = ServiceService.createService(
                    token = token,
                    title = title.trim(),
                    description = description.trim().ifBlank { null },
                    category = category.trim().ifBlank { null },
                    location = location.trim().ifBlank { null },
                    price = price.toDoubleOrNull()?.coerceAtLeast(0.0) ?: 0.0,
                    imageUrl = imageUrl.trim().ifBlank { null },
                    lat = lat,
                    lng = lng
                )
                _create.value = CreateServiceUiState(created = service)
                // Refresh the host services list so the new one shows up.
                loadHost()
            } catch (e: Exception) {
                _create.value = CreateServiceUiState(error = e.message ?: "Couldn't publish the service.")
            }
        }
    }

    /** Resets the create-service form (after dismissing success, to add another). */
    fun resetCreate() {
        _create.value = CreateServiceUiState()
    }
}
