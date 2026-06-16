package com.quickin.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import java.util.Locale

/**
 * Canonical, sorted list of country display names used by the signup form and profile settings.
 *
 * Built from [Locale.getISOCountries] mapped to each region's *English* display name
 * (`Locale("", code).getDisplayCountry(Locale.ENGLISH)`) so the value we store/send is stable and
 * matches the web app regardless of the phone's UI language. Egypt is pinned to the top as a
 * sensible default for this market; the remainder are alphabetical. Codes with no display name are
 * dropped, and duplicates are removed.
 */
val Countries: List<String> = run {
    val preferred = "Egypt"
    val all = Locale.getISOCountries()
        .asSequence()
        .map { code -> Locale("", code).getDisplayCountry(Locale.ENGLISH).trim() }
        .filter { it.isNotEmpty() && it != preferred }
        .distinct()
        .sorted()
        .toList()
    listOf(preferred) + all
}

/**
 * A read-only, tappable field that mirrors the boutique [OutlinedTextField] styling used across the
 * auth and profile screens. Tapping it opens a searchable dialog ([CountryPickerDialog]) of
 * [Countries]; choosing one calls [onSelect] with the English display name (the value persisted /
 * sent to the backend). [value] is the currently-selected country, or blank when none is chosen.
 *
 * RTL-safe: relies on the parent layout direction, uses a start-aligned label and an end-aligned
 * dropdown chevron via the [Row] arrangement, and the dialog list reads naturally in both locales.
 */
@Composable
fun CountrySelector(
    value: String,
    onSelect: (String) -> Unit,
    label: String,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    var dialogOpen by remember { mutableStateOf(false) }

    // A disabled OutlinedTextField laid over a clickable Box: we get the exact field chrome
    // (label float, rounded border, colors) while the tap opens the dialog instead of the keyboard.
    Box(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            enabled = false,
            label = { Text(label) },
            singleLine = true,
            leadingIcon = { Icon(Icons.Filled.Public, contentDescription = null, tint = Burgundy) },
            trailingIcon = { Icon(Icons.Filled.ArrowDropDown, contentDescription = null, tint = Muted) },
            shape = RoundedCornerShape(18.dp),
            colors = OutlinedTextFieldDefaults.colors(
                // Render the "disabled" state as if it were enabled so the field doesn't look greyed out.
                disabledBorderColor = Tan,
                disabledLabelColor = Muted,
                disabledLeadingIconColor = Burgundy,
                disabledTrailingIconColor = Muted,
                disabledTextColor = Ink,
                disabledContainerColor = Color.White
            ),
            modifier = Modifier.fillMaxWidth()
        )
        // Transparent overlay captures the tap (the field itself is disabled).
        Box(
            modifier = Modifier
                .matchFieldSize()
                .clickable(enabled = enabled) { dialogOpen = true }
        )
    }

    if (dialogOpen) {
        CountryPickerDialog(
            selected = value,
            onDismiss = { dialogOpen = false },
            onSelect = {
                onSelect(it)
                dialogOpen = false
            }
        )
    }
}

/** Stretches the overlay to fill the parent Box (same footprint as the text field). */
private fun Modifier.matchFieldSize(): Modifier = this.fillMaxWidth().heightIn(min = 56.dp)

/**
 * Searchable single-select dialog over [Countries]. A search field filters the list
 * case-insensitively (substring match); tapping a row selects it. The currently [selected] country
 * shows a check. Bilingual via string resources; the list scrolls for the full ISO set.
 */
@Composable
private fun CountryPickerDialog(
    selected: String,
    onDismiss: () -> Unit,
    onSelect: (String) -> Unit
) {
    var query by remember { mutableStateOf("") }
    val filtered = remember(query) {
        val q = query.trim()
        if (q.isEmpty()) Countries
        else Countries.filter { it.contains(q, ignoreCase = true) }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.signup_country_select), fontWeight = FontWeight.Bold, color = Ink) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    label = { Text(stringResource(R.string.signup_country_search)) },
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = Muted) },
                    keyboardOptions = KeyboardOptions(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Burgundy,
                        unfocusedBorderColor = Tan,
                        focusedLabelColor = Burgundy,
                        cursorColor = Burgundy
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                if (filtered.isEmpty()) {
                    Text(
                        stringResource(R.string.signup_country_none),
                        color = Muted,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(vertical = 24.dp)
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(vertical = 8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 320.dp)
                    ) {
                        items(filtered, key = { it }) { country ->
                            CountryRow(
                                country = country,
                                selected = country == selected,
                                onClick = { onSelect(country) }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cd_back), color = Burgundy, fontWeight = FontWeight.SemiBold)
            }
        }
    )
}

@Composable
private fun CountryRow(
    country: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(if (selected) Tan.copy(alpha = 0.4f) else Color.Transparent, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 12.dp)
    ) {
        Text(
            country,
            color = Ink,
            fontSize = 15.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
        )
        if (selected) {
            Icon(Icons.Filled.Check, contentDescription = null, tint = Burgundy, modifier = Modifier.size(20.dp))
        }
    }
}
