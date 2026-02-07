//
//  PasswordValidator.swift
//  GCWadmin
//
//  Password validation matching backend requirements
//

import Foundation

struct PasswordValidator {
    enum ValidationResult {
        case valid
        case invalid(String)

        var isValid: Bool {
            if case .valid = self { return true }
            return false
        }

        var message: String? {
            if case .invalid(let msg) = self { return msg }
            return nil
        }
    }

    static func validate(_ password: String) -> ValidationResult {
        let minLength = 8

        // Check minimum length
        if password.isEmpty || password.count < minLength {
            return .invalid("Password must be at least \(minLength) characters long")
        }

        // Check for uppercase letters
        if !password.contains(where: { $0.isUppercase }) {
            return .invalid("Password must contain at least one uppercase letter")
        }

        // Check for lowercase letters
        if !password.contains(where: { $0.isLowercase }) {
            return .invalid("Password must contain at least one lowercase letter")
        }

        // Check for numbers
        if !password.contains(where: { $0.isNumber }) {
            return .invalid("Password must contain at least one number")
        }

        // Check for special characters
        let specialCharacters = CharacterSet(charactersIn: "!@#$%^&*(),.?\":{}|<>")
        if password.unicodeScalars.first(where: { specialCharacters.contains($0) }) == nil {
            return .invalid("Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)")
        }

        return .valid
    }

    static func getRequirements() -> [String] {
        return [
            "At least 8 characters long",
            "At least one uppercase letter",
            "At least one lowercase letter",
            "At least one number",
            "At least one special character (!@#$%^&*(),.?\":{}|<>)"
        ]
    }

    static func checkRequirements(_ password: String) -> [Bool] {
        return [
            password.count >= 8,
            password.contains(where: { $0.isUppercase }),
            password.contains(where: { $0.isLowercase }),
            password.contains(where: { $0.isNumber }),
            password.unicodeScalars.first(where: { CharacterSet(charactersIn: "!@#$%^&*(),.?\":{}|<>").contains($0) }) != nil
        ]
    }
}
