//
//  LanguageManager.swift
//  GCWadmin
//
//  Multi-language support (English/Spanish) matching React Native LanguageContext
//

import SwiftUI
import Combine

// MARK: - Supported Languages
enum Language: String, CaseIterable {
    case english = "en"
    case spanish = "es"

    var displayName: String {
        switch self {
        case .english: return "English"
        case .spanish: return "Español"
        }
    }

    var flag: String {
        switch self {
        case .english: return "🇺🇸"
        case .spanish: return "🇲🇽"
        }
    }
}

// MARK: - Language Manager
@MainActor
class LanguageManager: ObservableObject {
    @Published var currentLanguage: Language = .english

    private let languageKey = "selected_language"

    init() {
        // Load saved language preference
        if let savedLanguage = UserDefaults.standard.string(forKey: languageKey),
           let language = Language(rawValue: savedLanguage) {
            currentLanguage = language
        }
    }

    func setLanguage(_ language: Language) {
        currentLanguage = language
        UserDefaults.standard.set(language.rawValue, forKey: languageKey)
    }

    /// Get localized string
    func t(_ key: String) -> String {
        return translations[key]?[currentLanguage] ?? key
    }
}

// MARK: - Translations Dictionary
private let translations: [String: [Language: String]] = [
    // Auth
    "login": [.english: "Login", .spanish: "Iniciar Sesión"],
    "logout": [.english: "Logout", .spanish: "Cerrar Sesión"],
    "username": [.english: "Username", .spanish: "Usuario"],
    "password": [.english: "Password", .spanish: "Contraseña"],
    "sign_in": [.english: "Sign In", .spanish: "Ingresar"],
    "signing_in": [.english: "Signing In...", .spanish: "Ingresando..."],
    "admin_login": [.english: "Admin Login", .spanish: "Acceso Administrativo"],

    // Dashboard
    "admin_panel": [.english: "Admin Panel", .spanish: "Panel de Administración"],
    "welcome": [.english: "Welcome", .spanish: "Bienvenido"],

    // Sections
    "prices": [.english: "Prices", .spanish: "Precios"],
    "photos": [.english: "Photos", .spanish: "Fotos"],
    "employees": [.english: "Employees", .spanish: "Empleados"],
    "timeclock": [.english: "Time Clock", .spanish: "Reloj de Tiempo"],
    "designs": [.english: "Designs", .spanish: "Diseños"],
    "invoices": [.english: "Invoices", .spanish: "Facturas"],
    "testimonials": [.english: "Testimonials", .spanish: "Testimonios"],
    "instagram": [.english: "Instagram", .spanish: "Instagram"],
    "timelines": [.english: "Timelines", .spanish: "Cronogramas"],
    "appointments": [.english: "Appointments", .spanish: "Citas"],
    "showroom": [.english: "Showroom", .spanish: "Sala de Exhibición"],
    "users": [.english: "Users", .spanish: "Usuarios"],
    "analytics": [.english: "Analytics", .spanish: "Analíticas"],
    "sms_routing": [.english: "SMS Routing", .spanish: "Enrutamiento SMS"],
    "security": [.english: "Security", .spanish: "Seguridad"],

    // Time Clock
    "clock_in": [.english: "Clock In", .spanish: "Entrada"],
    "clock_out": [.english: "Clock Out", .spanish: "Salida"],
    "on_break": [.english: "On Break", .spanish: "En Descanso"],
    "start_break": [.english: "Start Break", .spanish: "Iniciar Descanso"],
    "end_break": [.english: "End Break", .spanish: "Terminar Descanso"],

    // Common
    "save": [.english: "Save", .spanish: "Guardar"],
    "cancel": [.english: "Cancel", .spanish: "Cancelar"],
    "delete": [.english: "Delete", .spanish: "Eliminar"],
    "edit": [.english: "Edit", .spanish: "Editar"],
    "add": [.english: "Add", .spanish: "Agregar"],
    "search": [.english: "Search", .spanish: "Buscar"],
    "loading": [.english: "Loading...", .spanish: "Cargando..."],
    "error": [.english: "Error", .spanish: "Error"],
    "success": [.english: "Success", .spanish: "Éxito"],

    // Roles
    "employee": [.english: "Employee", .spanish: "Empleado"],
    "admin": [.english: "Admin", .spanish: "Administrador"],
    "super_admin": [.english: "Super Admin", .spanish: "Super Administrador"],
]

// MARK: - View Extension for Localization
extension View {
    /// Access language manager from environment
    func localized(_ key: String, languageManager: LanguageManager) -> String {
        languageManager.t(key)
    }
}

// MARK: - String Extension
extension String {
    /// Get localized version using language manager
    func localized(using manager: LanguageManager) -> String {
        manager.t(self)
    }
}
