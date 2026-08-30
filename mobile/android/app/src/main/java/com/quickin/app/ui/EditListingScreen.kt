package com.quickin.app.ui

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.android.gms.maps.model.LatLng
import com.quickin.app.Commission
import com.quickin.app.ResortCatalogUiState
import com.quickin.app.ResortChoice
import com.quickin.app.ResortOption
import com.quickin.app.WeekendSchedule
import com.quickin.app.AiWriterUiState
import com.quickin.app.AvatarImage
import com.quickin.app.EditListingUiState
import com.quickin.app.ListingCapacityPolicy
import com.quickin.app.ListingPricingRules
import com.quickin.app.MonthPriceException
import com.quickin.app.ListingTitlePolicy
import com.quickin.app.OwnershipDocLoader
import com.quickin.app.Listing
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.GoldDeep
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val EditErrorRed = Color(0xFFB3261E)

/**
 * The host's full listing editor — EVERY field of one of their own listings plus photo management
 * (add, delete, reorder, set cover), saved in one `PATCH /api/local/listings/:id`.
 *
 * It is deliberately built from the *same* composables as the add-listing wizard
 * ([StepBasics] / [StepLocation] / [StepDetails] in HostScreen.kt), so the fields, the pickers and
 * the validation are literally the create flow's — there is no second set of rules to drift. The
 * only differences are the shape (one scrolling page instead of a 4-step wizard, since the host is
 * editing rather than filling in from scratch) and the photo controls, which gain reorder /
 * set-cover here.
 *
 * **Re-review is the point.** Any successful save sends the listing back to the admin queue and
 * hides it from guests until it's approved, so the host is told twice: a standing notice above the
 * form, and a confirmation dialog on Save that they have to accept. Photo edits are staged locally
 * (never applied behind the host's back) so that single Save is the one moment the listing goes
 * back into review. Once saved, the screen confirms with the same [ApprovalBadge] the host
 * listings screen uses, now reading "Pending review".
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditListingScreen(
    listing: Listing,
    state: EditListingUiState,
    onBack: () -> Unit,
    onSave: (
        title: String, description: String, location: String, country: String, region: String?,
        /** The resort / compound, or null when the host never touched it — the two resort columns
         *  are then left exactly as they are. */
        resort: ResortChoice.Selection?,
        pricePerNight: String, maxGuests: String, bedrooms: String, beds: String, bathrooms: String,
        propertyType: String, amenities: List<String>, lat: Double?, lng: Double?,
        cancellationPolicy: String, weeklyDiscount: String, monthlyDiscount: String,
        weekendPrice: String, weekendDays: List<Int>, monthlyPrices: Map<String, Double>,
        images: List<String>?, ownershipDoc: String?
    ) -> Unit,
    // ---- AI listing-description writer (shared with the add-listing wizard) ----
    aiWriter: AiWriterUiState = AiWriterUiState(),
    onGenerateDescription: (
        title: String, location: String, region: String, propertyType: String,
        bedrooms: Int, maxGuests: Int, amenities: List<String>, notes: String
    ) -> Unit = { _, _, _, _, _, _, _, _ -> },
    onConsumeGeneratedDescription: () -> Unit = {},
    onClearAiWriter: () -> Unit = {},
    /** The resort / compound catalog for the listing's area, and the request to load it. */
    resortCatalog: ResortCatalogUiState = ResortCatalogUiState(),
    onLoadResorts: (String?) -> Unit = {},
    /** Platform commission — drives the "guests will see EGP X" hint under the price fields. */
    commission: Commission? = null
) {
    // A saved listing replaces the form with a confirmation card (guarded on the id so a stale
    // success from a previously-edited listing can't flash here).
    val saved = state.saved
    if (saved != null && saved.id == listing.id) {
        SavedForReviewCard(saved = saved, onDone = onBack)
        return
    }

    // ---- Form state, seeded from the listing (re-seeds if a different listing is opened) ----
    val seed = remember(listing.id) { ListingFormSeed.of(listing) }

    var title by remember(listing.id) { mutableStateOf(seed.title) }
    var description by remember(listing.id) { mutableStateOf(seed.description) }
    var location by remember(listing.id) { mutableStateOf(seed.location) }
    var country by remember(listing.id) { mutableStateOf(seed.country) }
    // Null when the listing's stored area isn't one of the curated REGIONS — the host has to pick
    // one before saving, exactly as the wizard requires on create.
    var region by remember(listing.id) { mutableStateOf(seed.region) }
    var resort by remember(listing.id) { mutableStateOf(seed.resort) }

    // The catalog belongs to the area, so it follows whatever area is currently picked. The
    // listing's OWN resort is kept in the list even when the area's catalog no longer carries it —
    // an admin may have deactivated it since — so the picker can still name what the listing says.
    LaunchedEffect(region) { onLoadResorts(region) }
    val resortsForArea = remember(resortCatalog, region, listing.id) {
        val loaded = if (resortCatalog.region == region) resortCatalog.resorts else emptyList()
        val own = seed.resort.id
        if (own != null && loaded.none { it.id == own }) {
            loaded + ResortOption(id = own, name = listing.resort.orEmpty(), region = region.orEmpty())
        } else {
            loaded
        }
    }
    // A resort belonging to a DIFFERENT area is dropped when the host switches areas: the server
    // derives the region back from the resort, and would overrule the chip they just tapped.
    LaunchedEffect(resortsForArea, resortCatalog) {
        val chosen = resort.id
        // Only once THIS area's catalog has actually come back: a catalog still holding the
        // previous area's rows says nothing about the resort the host picked, and dropping their
        // answer while the next fetch is in flight would look like the field clearing itself.
        val loadedForThisArea = resortCatalog.loaded && resortCatalog.region == region
        if (chosen != null && loadedForThisArea && resortsForArea.none { it.id == chosen }) {
            resort = ResortChoice.Selection.NONE
        }
    }
    var propertyType by remember(listing.id) { mutableStateOf(seed.propertyType) }
    var price by remember(listing.id) { mutableStateOf(seed.price) }
    var maxGuests by remember(listing.id) { mutableStateOf(seed.maxGuests) }
    var bedrooms by remember(listing.id) { mutableStateOf(seed.bedrooms) }
    var beds by remember(listing.id) { mutableStateOf(seed.beds) }
    var bathrooms by remember(listing.id) { mutableStateOf(seed.bathrooms) }
    var weeklyDiscount by remember(listing.id) { mutableStateOf(seed.weeklyDiscount) }
    var monthlyDiscount by remember(listing.id) { mutableStateOf(seed.monthlyDiscount) }
    var weekendPrice by remember(listing.id) { mutableStateOf(seed.weekendPrice) }
    val weekendDays = remember(listing.id) {
        mutableStateListOf<Int>().apply { addAll(seed.weekendDays) }
    }
    val monthlyPrices = remember(listing.id) {
        mutableStateMapOf<String, String>().apply { putAll(seed.monthlyPrices) }
    }
    // The photo set in display order — index 0 is the cover. Every photo action (add / remove /
    // move / set cover) edits this list only; it reaches the backend as the `images` replacement
    // set when the host saves.
    val photos = remember(listing.id) { mutableStateListOf<String>().apply { addAll(seed.photos) } }
    val selectedAmenities = remember(listing.id) { mutableStateListOf<String>().apply { addAll(seed.amenities) } }
    var cancellationPolicy by remember(listing.id) { mutableStateOf(seed.cancellationPolicy) }
    var pickedLatLng by remember(listing.id) { mutableStateOf(seed.latLng) }
    // A freshly attached ownership document, or null to keep whatever the listing already has.
    var ownershipDoc by remember(listing.id) { mutableStateOf<String?>(null) }
    var processingDoc by remember { mutableStateOf(false) }
    var encodingPhotos by remember { mutableStateOf(false) }

    var showSaveConfirm by remember { mutableStateOf(false) }
    var showDiscardConfirm by remember { mutableStateOf(false) }

    // Offer the curated amenity chips PLUS anything this listing already has, so an amenity the
    // app doesn't know about stays visible (and removable) instead of silently disappearing on save.
    val amenityOptions = remember(listing.id) {
        AMENITY_OPTIONS + seed.amenities.filter { existing ->
            AMENITY_OPTIONS.none { it.equals(existing, ignoreCase = true) }
        }
    }

    // AI writer: drop a generated description into the editable field, then mark it consumed.
    LaunchedEffect(aiWriter.generated) {
        aiWriter.generated?.let {
            description = it
            onConsumeGeneratedDescription()
        }
    }
    DisposableEffect(Unit) { onDispose { onClearAiWriter() } }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    // Same pipeline the wizard uses: a photo is downscaled to a data URL, a PDF is kept as it was
    // issued, and a file we can't store comes back named so the host is told which one to swap.
    var docProblem by remember { mutableStateOf<Int?>(null) }
    val docPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            processingDoc = true
            docProblem = null
            scope.launch {
                val result = withContext(Dispatchers.IO) { OwnershipDocLoader.load(context, uri) }
                when (result) {
                    is OwnershipDocLoader.Result.Loaded -> ownershipDoc = result.dataUrl
                    is OwnershipDocLoader.Result.Failed -> docProblem = result.problem.messageRes
                }
                processingDoc = false
            }
        }
    }
    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(MAX_LISTING_PHOTOS)
    ) { uris ->
        if (uris.isNotEmpty()) {
            encodingPhotos = true
            scope.launch {
                val remaining = (MAX_LISTING_PHOTOS - photos.size).coerceAtLeast(0)
                val encoded = withContext(Dispatchers.IO) {
                    uris.take(remaining).mapNotNull { uri ->
                        AvatarImage.loadDownscaledJpegDataUrl(context, uri, AvatarImage.MAX_REVIEW_DIM)
                    }
                }
                photos.addAll(encoded)
                encodingPhotos = false
            }
        }
    }

    /** Moves a photo within the set; [to] == 0 is "make this the cover". */
    fun movePhoto(from: Int, to: Int) {
        if (from !in photos.indices || to !in photos.indices || from == to) return
        photos.add(to, photos.removeAt(from))
    }

    // Only the photo set that actually changed is sent — re-uploading unchanged `data:` photos
    // would cost megabytes for an edit that only touched, say, the nightly price.
    val photosChanged = photos.toList() != seed.photos
    val hasChanges = title != seed.title ||
        description != seed.description ||
        location != seed.location ||
        country != seed.country ||
        region != seed.region ||
        resort != seed.resort ||
        propertyType != seed.propertyType ||
        price != seed.price ||
        maxGuests != seed.maxGuests ||
        bedrooms != seed.bedrooms ||
        beds != seed.beds ||
        bathrooms != seed.bathrooms ||
        weeklyDiscount != seed.weeklyDiscount ||
        monthlyDiscount != seed.monthlyDiscount ||
        weekendPrice != seed.weekendPrice ||
        WeekendSchedule.normalize(weekendDays) != seed.weekendDays ||
        monthlyPricesAsDoubles(monthlyPrices) != monthlyPricesAsDoubles(seed.monthlyPrices) ||
        selectedAmenities.toSet() != seed.amenities.toSet() ||
        cancellationPolicy != seed.cancellationPolicy ||
        pickedLatLng?.latitude != seed.latLng?.latitude ||
        pickedLatLng?.longitude != seed.latLng?.longitude ||
        photosChanged ||
        ownershipDoc != null

    // Why Save is unavailable, in the order a host would fix it. Null = ready to save. Mirrors the
    // backend's own rules on a PATCH, so a save can't bounce on something we could have said here.
    // The floors are letter counts, not `isBlank()`: `ok` cleared a non-empty
    // check and `12` passed as an address, and the PATCH refuses both now, so a
    // blank check here would turn a rule we could show into a 400 after Save.
    // The pin and the photo set are on this list for the same reason — a host can
    // clear either from this screen, and the backend refuses a listing left
    // without one. See listing-completeness-policy.ts in the web/backend repos.
    val titleProblem = ListingTitlePolicy.check(title)
    // Read before the `when` so their messages can be built with `stringResource`, which is itself
    // @Composable and so cannot be called from inside a `let`.
    val weekendRateProblem = ListingPricingRules.problemWith(weekendPrice)
    val badMonthRate: MonthPriceException? = ListingPricingRules.failingMonth(monthlyPrices)
    val blocker: String? = when {
        // `isBlank()` was the whole title rule here, so an edit could rename a live listing to
        // `@@@@@` and only learn otherwise from the API's 400 after Save. Same policy the create
        // wizard and the PATCH run. A typed-but-invalid title is called out under the field
        // itself, so this line only points back up at it.
        titleProblem == ListingTitlePolicy.Problem.REQUIRED -> listingTitleProblemMessage(titleProblem)
        titleProblem != null -> stringResource(R.string.listing_blocked_title)
        letterCount(description) < MIN_DESCRIPTION_LETTERS ->
            stringResource(R.string.listing_blocked_description, MIN_DESCRIPTION_LETTERS)
        letterCount(location) < MIN_LOCATION_LETTERS ->
            stringResource(R.string.listing_blocked_location, MIN_LOCATION_LETTERS)
        region == null -> stringResource(R.string.listing_edit_needs_region)
        // Optional, like everywhere else — only "Other" with no usable name is refused. See
        // ResortChoice.
        resortNameProblem(resort) != null -> resortNameProblemMessage(resortNameProblem(resort)!!)
        pickedLatLng == null -> stringResource(R.string.listing_edit_needs_pin)
        photosChanged && photos.isEmpty() -> stringResource(R.string.listing_edit_needs_photo)
        (price.toDoubleOrNull() ?: 0.0) <= 0.0 -> stringResource(R.string.listing_edit_needs_price)
        // The seasonal rates are optional, and optional means a BLANK field — a typed `0` used to
        // be parsed away to null on the way out and saved as no rate at all, so the host pressed
        // Save, was told the listing went back for review, and their weekend price was gone.
        weekendRateProblem != null -> stringResource(weekendPriceProblemRes(weekendRateProblem))
        badMonthRate != null -> stringResource(
            monthPriceProblemRes(badMonthRate.problem), stringResource(monthNameRes(badMonthRate.month))
        )
        // Bedrooms, beds, bathrooms and guests, all floored at 1. A listing published before
        // that floor existed opens here holding a 0, and the PATCH refuses it now — see
        // ListingCapacityPolicy — so this says it where the host can fix it.
        !ListingCapacityPolicy.allValid(maxGuests, bedrooms, beds, bathrooms) ->
            stringResource(R.string.listing_capacity_floor, ListingCapacityPolicy.MINIMUM)
        !hasChanges -> stringResource(R.string.listing_edit_no_changes)
        else -> null
    }

    fun requestBack() {
        if (hasChanges && !state.isSaving) showDiscardConfirm = true else onBack()
    }

    // Guard the system BACK press too, so edits aren't lost by reflex.
    BackHandler(enabled = hasChanges && !state.isSaving) { showDiscardConfirm = true }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.listing_edit_title), color = Ink, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { requestBack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Ink)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CreamPage)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(CreamPage)
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // The standing warning — before a single field is touched.
                ReviewNoticeBanner()

                Text(listing.title, color = Muted, fontSize = 13.sp, fontWeight = FontWeight.Medium)

                // Same marks, same legend as the add wizard — this screen renders the wizard's
                // own step composables, and gates Save on the same fields they mark.
                RequiredFieldsLegend()

                SectionHeader(stringResource(R.string.listing_edit_section_basics))
                StepBasics(
                    title = title, onTitle = { title = it },
                    propertyType = propertyType, onPropertyType = { propertyType = it },
                    description = description, onDescription = { description = it },
                    titleProblem = titleProblem,
                    aiWriter = aiWriter,
                    onGenerate = {
                        onGenerateDescription(
                            title,
                            location,
                            region.orEmpty(),
                            propertyType,
                            bedrooms.toIntOrNull() ?: 1,
                            maxGuests.toIntOrNull() ?: 2,
                            selectedAmenities.toList(),
                            description
                        )
                    }
                )

                SectionHeader(stringResource(R.string.listing_edit_section_location))
                StepLocation(
                    region = region, onRegion = { region = it },
                    resort = resort, onResort = { resort = it },
                    resorts = resortsForArea,
                    resortsLoading = resortCatalog.isLoading,
                    location = location, onLocation = { location = it },
                    country = country, onCountry = { country = it },
                    picked = pickedLatLng, onPick = { pickedLatLng = it }
                )

                SectionHeader(stringResource(R.string.listing_edit_section_details))
                StepDetails(
                    maxGuests = maxGuests, onMaxGuests = { maxGuests = it },
                    bedrooms = bedrooms, onBedrooms = { bedrooms = it },
                    beds = beds, onBeds = { beds = it },
                    bathrooms = bathrooms, onBathrooms = { bathrooms = it },
                    price = price, onPrice = { price = it },
                    weeklyDiscount = weeklyDiscount, onWeeklyDiscount = { weeklyDiscount = it },
                    monthlyDiscount = monthlyDiscount, onMonthlyDiscount = { monthlyDiscount = it },
                    weekendPrice = weekendPrice, onWeekendPrice = { weekendPrice = it },
                    weekendDays = weekendDays.toSet(),
                    onToggleWeekendDay = { day ->
                        // The seventh day is refused, not silently added: a weekend that covers
                        // the whole week leaves the nightly price applying to no night at all.
                        if (weekendDays.contains(day)) weekendDays.remove(day)
                        else if (weekendDays.size < WeekendSchedule.DAYS_IN_WEEK - 1) weekendDays.add(day)
                    },
                    monthlyPrices = monthlyPrices,
                    onMonthlyPrice = { month, value ->
                        if (value.isBlank()) monthlyPrices.remove(key = month) else monthlyPrices[month] = value
                    },
                    commission = commission,
                    photos = photos,
                    encodingPhotos = encodingPhotos,
                    onAddPhotos = {
                        photoPicker.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                        )
                    },
                    onRemovePhoto = { index -> if (index in photos.indices) photos.removeAt(index) },
                    selectedAmenities = selectedAmenities,
                    onToggleAmenity = { amenity ->
                        if (selectedAmenities.contains(amenity)) selectedAmenities.remove(amenity)
                        else selectedAmenities.add(amenity)
                    },
                    cancellationPolicy = cancellationPolicy,
                    onCancellationPolicy = { cancellationPolicy = it },
                    ownershipDoc = ownershipDoc,
                    processingDoc = processingDoc,
                    onPickDoc = { docPicker.launch(OwnershipDocLoader.PICKER_MIME_TYPES) },
                    docProblem = docProblem,
                    onMovePhoto = { from, to -> movePhoto(from, to) },
                    onSetCoverPhoto = { index -> movePhoto(index, 0) },
                    amenityOptions = amenityOptions
                )
            }

            // ---- Sticky Cancel / Save bar ----
            Surface(color = Cream, shadowElevation = 8.dp) {
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp)) {
                    // A failed save, else why Save is unavailable — both belong next to the button
                    // rather than at the end of a long scrolling form.
                    if (state.error != null) {
                        Text(
                            state.error,
                            color = EditErrorRed,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                    } else if (blocker != null) {
                        Text(
                            blocker,
                            color = Muted,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                    }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedButton(
                            onClick = { requestBack() },
                            enabled = !state.isSaving,
                            shape = RoundedCornerShape(16.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = Color.White,
                                contentColor = Burgundy
                            ),
                            modifier = Modifier.weight(1f).height(54.dp)
                        ) { Text(stringResource(R.string.listing_edit_cancel), fontWeight = FontWeight.SemiBold) }

                        GradientButton(
                            onClick = { showSaveConfirm = true },
                            enabled = blocker == null && !state.isSaving,
                            modifier = Modifier.weight(1f)
                        ) {
                            if (state.isSaving) {
                                CircularProgressIndicator(
                                    color = Color.White,
                                    strokeWidth = 2.dp,
                                    modifier = Modifier.size(22.dp)
                                )
                            } else {
                                Text(
                                    stringResource(R.string.listing_edit_save),
                                    color = Color.White,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 16.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // ---- "This sends your listing back for review" — accepted before anything is sent ----
    if (showSaveConfirm) {
        AlertDialog(
            onDismissRequest = { showSaveConfirm = false },
            icon = { WarningBadge() },
            containerColor = Cream,
            title = {
                Text(
                    stringResource(R.string.listing_edit_review_title),
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    fontSize = 19.sp,
                    textAlign = TextAlign.Center
                )
            },
            text = {
                Text(
                    stringResource(R.string.listing_edit_review_body),
                    color = Ink,
                    fontSize = 15.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showSaveConfirm = false
                        onSave(
                            title, description, location, country, region,
                            // null when the host never touched the resort — the columns are then
                            // left alone rather than being rewritten with what we happen to hold.
                            resort.takeIf { it != seed.resort },
                            price, maxGuests, bedrooms, beds, bathrooms,
                            propertyType, selectedAmenities.toList(),
                            pickedLatLng?.latitude, pickedLatLng?.longitude,
                            cancellationPolicy, weeklyDiscount, monthlyDiscount,
                            weekendPrice, WeekendSchedule.normalize(weekendDays),
                            monthlyPricesAsDoubles(monthlyPrices),
                            // null leaves the listing's photos untouched.
                            if (photosChanged) photos.toList() else null,
                            ownershipDoc
                        )
                    },
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
                ) { Text(stringResource(R.string.listing_edit_review_confirm), fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = {
                TextButton(onClick = { showSaveConfirm = false }) {
                    Text(stringResource(R.string.listing_edit_keep_editing), color = Muted, fontWeight = FontWeight.SemiBold)
                }
            }
        )
    }

    // ---- Leaving with unsaved edits ----
    if (showDiscardConfirm) {
        AlertDialog(
            onDismissRequest = { showDiscardConfirm = false },
            containerColor = Cream,
            title = {
                Text(
                    stringResource(R.string.listing_edit_discard_title),
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    fontSize = 19.sp
                )
            },
            text = {
                Text(stringResource(R.string.listing_edit_discard_body), color = Ink, fontSize = 15.sp)
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDiscardConfirm = false
                        onBack()
                    },
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = EditErrorRed, contentColor = Color.White)
                ) { Text(stringResource(R.string.listing_edit_discard_confirm), fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = {
                TextButton(onClick = { showDiscardConfirm = false }) {
                    Text(stringResource(R.string.listing_edit_keep_editing), color = Muted, fontWeight = FontWeight.SemiBold)
                }
            }
        )
    }
}

/**
 * The standing notice above the editor: saving sends the listing back for review and hides it from
 * guests until an admin approves. Gold-tinted like the other "heads up" notes on listing screens.
 */
@Composable
private fun ReviewNoticeBanner() {
    Surface(
        color = Gold.copy(alpha = 0.16f),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(verticalAlignment = Alignment.Top, modifier = Modifier.padding(14.dp)) {
            Icon(
                Icons.Filled.WarningAmber,
                contentDescription = null,
                tint = GoldDeep,
                modifier = Modifier.size(20.dp)
            )
            Spacer(Modifier.width(10.dp))
            Column {
                Text(
                    stringResource(R.string.listing_edit_review_title),
                    color = GoldDeep,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    stringResource(R.string.listing_edit_review_body),
                    color = GoldDeep,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }
    }
}

/** The soft amber warning glyph used by the save-confirmation dialog. */
@Composable
private fun WarningBadge() {
    Box(
        modifier = Modifier
            .size(56.dp)
            .clip(CircleShape)
            .background(Gold.copy(alpha = 0.16f)),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            Icons.Filled.WarningAmber,
            contentDescription = null,
            tint = GoldDeep,
            modifier = Modifier.size(30.dp)
        )
    }
}

/**
 * The post-save confirmation: the listing was updated AND is now back in the admin queue. It shows
 * the very same [ApprovalBadge] the host listings screen uses, which the backend's response has
 * already flipped to "Pending review" — the host's card behind this screen reads the same.
 */
@Composable
private fun SavedForReviewCard(saved: Listing, onDone: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().background(CreamPage).padding(28.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            PopIn { DrawCheckmark(size = 72.dp) }
            Text(
                stringResource(R.string.listing_edit_saved),
                fontWeight = FontWeight.Bold,
                color = Ink,
                fontSize = 20.sp,
                modifier = Modifier.padding(top = 14.dp)
            )
            Text(
                saved.title,
                color = Ink,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 6.dp)
            )
            Spacer(Modifier.height(10.dp))
            ApprovalBadge(approval = saved.approval)
            Text(
                stringResource(R.string.listing_edit_saved_note),
                color = Muted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 10.dp)
            )
            GradientButton(
                onClick = onDone,
                height = 52.dp,
                modifier = Modifier.fillMaxWidth().padding(top = 24.dp)
            ) {
                Text(
                    stringResource(R.string.listing_edit_done),
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

/**
 * The editor's starting values, derived from the listing once. They seed every field AND act as the
 * baseline for "did anything actually change?" — without that check, opening the editor and hitting
 * Save would take a live listing offline for an edit that wasn't one.
 */
private data class ListingFormSeed(
    val title: String,
    val description: String,
    val location: String,
    val country: String,
    val region: String?,
    /** What the listing arrived with: a catalog id, the host's own text, or neither. */
    val resort: ResortChoice.Selection,
    val propertyType: String,
    val price: String,
    val maxGuests: String,
    val bedrooms: String,
    val beds: String,
    val bathrooms: String,
    val weeklyDiscount: String,
    val monthlyDiscount: String,
    val weekendPrice: String,
    /** Which weekdays the weekend rate is charged on (`0`=Sun … `6`=Sat). */
    val weekendDays: List<Int>,
    val monthlyPrices: Map<String, String>,
    val photos: List<String>,
    val amenities: List<String>,
    val cancellationPolicy: String,
    val latLng: LatLng?
) {
    companion object {
        fun of(listing: Listing) = ListingFormSeed(
            title = listing.title,
            description = listing.description.orEmpty(),
            location = listing.location.orEmpty(),
            country = listing.country?.takeUnless { it.isBlank() } ?: "Egypt",
            // Only a curated area can be sent back; anything else means "the host must pick one".
            region = REGIONS.firstOrNull { it.equals(listing.region, ignoreCase = true) },
            // Only the free-text name seeds the box: when the listing points at a catalog row,
            // `resort` is that row's name, and re-sending it as text would ask the server to
            // re-resolve a question it has already answered.
            resort = when {
                !listing.resortId.isNullOrBlank() -> ResortChoice.Selection.catalog(listing.resortId)
                !ResortChoice.normalizeName(listing.resort).isNullOrBlank() ->
                    ResortChoice.Selection.other(ResortChoice.normalizeName(listing.resort)!!)
                else -> ResortChoice.Selection.NONE
            },
            // Keep an unrecognised type as-is (the backend knows more types than the picker offers)
            // rather than silently re-typing the property on the next save.
            propertyType = listing.propertyType?.takeUnless { it.isBlank() } ?: PROPERTY_TYPES.first(),
            price = listing.pricePerNight.toInt().toString(),
            // A NULL column is a question nobody asked, so it opens at the floor rather than
            // at 0 — see ListingCapacityPolicy.seed. A stored 0 is shown as it is, and the
            // blocker above holds Save until the host raises it.
            maxGuests = ListingCapacityPolicy.seed(listing.maxGuests),
            bedrooms = ListingCapacityPolicy.seed(listing.bedrooms),
            beds = ListingCapacityPolicy.seed(listing.beds),
            bathrooms = ListingCapacityPolicy.seed(listing.bathrooms),
            weeklyDiscount = listing.weeklyDiscount.toString(),
            monthlyDiscount = listing.monthlyDiscount.toString(),
            weekendPrice = listing.weekendPrice?.takeIf { it > 0.0 }?.toInt()?.toString().orEmpty(),
            // `effective` and not the raw value: a listing whose host never chose is priced on the
            // default weekend, so that is what the pills must open on — and it is also what the
            // dirty check compares against, so merely opening the editor is not an edit.
            weekendDays = WeekendSchedule.effective(listing.weekendDays),
            monthlyPrices = listing.monthlyPrices
                .filterValues { it > 0.0 }
                .mapValues { (_, v) -> v.toInt().toString() },
            photos = listing.sortedImageUrls,
            amenities = listing.amenities,
            cancellationPolicy = listing.cancellationPolicy,
            latLng = if (listing.lat != null && listing.lng != null) LatLng(listing.lat, listing.lng) else null
        )
    }
}
