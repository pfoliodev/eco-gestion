# Script PowerShell pour découper styles.css en modules

$cssPath = "c:\Users\33785\Desktop\eco-gestion\public\styles.css"
$css = Get-Content $cssPath -Raw

# Définir les patterns pour chaque module
$modules = @{
    "components/navigation.css" = @("/* Header", "header {", ".nav-", ".profile-dropdown", ".dropdown-menu")
    "components/buttons.css" = @(".btn-", "button {", ".button")
    "components/cards.css" = @(".card", ".course-card", ".feature-card")
    "components/forms.css" = @("input", "textarea", "select", "form", ".form-")
    "components/modals.css" = @(".modal", ".overlay")
    "components/badges.css" = @(".badge", ".pantheon")
    "components/tables.css" = @("table", ".admin-table")
    "pages/home.css" = @(".features-carousel", ".reminders", ".home-")
    "pages/courses.css" = @(".courses-", ".course-detail")
    "pages/admin.css" = @(".admin-", ".config-")
    "pages/account.css" = @(".account-", ".profile-")
    "pages/flashcards.css" = @(".flashcard-", ".fc-")
}

Write-Host "CSS Modularization Script Ready"
Write-Host "Total CSS size: $($css.Length) bytes"
