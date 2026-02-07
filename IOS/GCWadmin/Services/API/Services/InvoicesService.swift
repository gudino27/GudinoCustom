//
//  InvoicesService.swift
//  GCWadmin
//
//  API service for Invoices endpoints
//

import Foundation

class InvoicesService {
    static let shared = InvoicesService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Invoice CRUD

    func getAllInvoices() async throws -> [Invoice] {
        return try await apiClient.get("/api/admin/invoices")
    }

    func getInvoice(_ id: Int) async throws -> InvoiceDetail {
        return try await apiClient.get("/api/admin/invoices/\(id)")
    }

    func createInvoice(_ body: [String: Any]) async throws -> InvoiceCreateMinimalResponse {
        return try await apiClient.post("/api/admin/invoices", body: body)
    }

    func updateInvoice(_ id: Int, body: [String: Any]) async throws -> InvoiceDetail {
        return try await apiClient.put("/api/admin/invoices/\(id)", body: body)
    }

    func deleteInvoice(_ id: Int) async throws {
        let _: InvoiceMessageResponse = try await apiClient.delete("/api/admin/invoices/\(id)")
    }

    // MARK: - Payments

    func getPayments(invoiceId: Int) async throws -> [InvoicePayment] {
        return try await apiClient.get("/api/admin/invoices/\(invoiceId)/payments")
    }

    func addPayment(invoiceId: Int, amount: Double, method: String, checkNumber: String? = nil, date: String, notes: String? = nil) async throws {
        var body: [String: Any] = [
            "payment_amount": amount,
            "payment_method": method,
            "payment_date": date
        ]
        if let checkNumber = checkNumber {
            body["check_number"] = checkNumber
        }
        if let notes = notes {
            body["notes"] = notes
        }
        let _: ClientCreateResponse = try await apiClient.post(
            "/api/admin/invoices/\(invoiceId)/payments",
            body: body
        )
    }

    func updatePayment(_ id: Int, amount: Double, method: String, checkNumber: String? = nil, date: String, notes: String? = nil) async throws {
        var body: [String: Any] = [
            "payment_amount": amount,
            "payment_method": method,
            "payment_date": date
        ]
        if let checkNumber = checkNumber {
            body["check_number"] = checkNumber
        }
        if let notes = notes {
            body["notes"] = notes
        }
        let _: InvoiceMessageResponse = try await apiClient.put(
            "/api/admin/invoices/payments/\(id)",
            body: body
        )
    }

    func deletePayment(_ id: Int) async throws {
        let _: InvoiceMessageResponse = try await apiClient.delete("/api/admin/invoices/payments/\(id)")
    }

    // MARK: - Clients

    func getAllClients() async throws -> [Client] {
        return try await apiClient.get("/api/admin/invoices/clients")
    }

    func getClient(_ id: Int) async throws -> Client {
        return try await apiClient.get("/api/admin/invoices/clients/\(id)")
    }

    func createClient(firstName: String, lastName: String, email: String? = nil, phone: String? = nil, address: String? = nil, companyName: String? = nil, isBusiness: Bool = false, taxExemptNumber: String? = nil) async throws -> ClientCreateResponse {
        var body: [String: Any] = [
            "first_name": firstName,
            "last_name": lastName,
            "is_business": isBusiness ? 1 : 0
        ]
        if let email = email { body["email"] = email }
        if let phone = phone { body["phone"] = phone }
        if let address = address { body["address"] = address }
        if let companyName = companyName { body["company_name"] = companyName }
        if let taxExemptNumber = taxExemptNumber { body["tax_exempt_number"] = taxExemptNumber }

        return try await apiClient.post("/api/admin/invoices/clients", body: body)
    }

    func updateClient(_ id: Int, firstName: String, lastName: String, email: String? = nil, phone: String? = nil, address: String? = nil, companyName: String? = nil, isBusiness: Bool = false, taxExemptNumber: String? = nil) async throws {
        var body: [String: Any] = [
            "first_name": firstName,
            "last_name": lastName,
            "is_business": isBusiness ? 1 : 0
        ]
        if let email = email { body["email"] = email }
        if let phone = phone { body["phone"] = phone }
        if let address = address { body["address"] = address }
        if let companyName = companyName { body["company_name"] = companyName }
        if let taxExemptNumber = taxExemptNumber { body["tax_exempt_number"] = taxExemptNumber }

        let _: ClientUpdateResponse = try await apiClient.put("/api/admin/invoices/clients/\(id)", body: body)
    }

    func deleteClient(_ id: Int) async throws {
        let _: InvoiceMessageResponse = try await apiClient.delete("/api/admin/invoices/clients/\(id)")
    }

    func searchClients(query: String) async throws -> [Client] {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        return try await apiClient.get("/api/admin/invoices/clients/search?q=\(encoded)")
    }

    // MARK: - Tax Rates

    func getAllTaxRates() async throws -> [TaxRate] {
        return try await apiClient.get("/api/admin/invoices/tax-rates")
    }

    func createTaxRate(city: String, stateCode: String? = nil, taxRate: Double, description: String? = nil) async throws {
        var body: [String: Any] = [
            "city": city,
            "tax_rate": taxRate
        ]
        if let stateCode = stateCode { body["state_code"] = stateCode }
        if let description = description { body["description"] = description }

        let _: InvoiceMessageResponse = try await apiClient.post("/api/admin/invoices/tax-rates", body: body)
    }

    func updateTaxRate(_ id: Int, city: String, stateCode: String? = nil, taxRate: Double, description: String? = nil) async throws {
        var body: [String: Any] = [
            "city": city,
            "tax_rate": taxRate
        ]
        if let stateCode = stateCode { body["state_code"] = stateCode }
        if let description = description { body["description"] = description }

        let _: InvoiceMessageResponse = try await apiClient.put("/api/admin/invoices/tax-rates/\(id)", body: body)
    }

    func deleteTaxRate(_ id: Int) async throws {
        let _: InvoiceMessageResponse = try await apiClient.delete("/api/admin/invoices/tax-rates/\(id)")
    }

    // MARK: - Line Item Labels

    func getAllLabels() async throws -> [LineItemLabel] {
        return try await apiClient.get("/api/admin/invoices/line-item-labels")
    }

    func createLabel(name: String, defaultPrice: Double? = nil) async throws {
        var body: [String: Any] = ["label_name": name]
        if let defaultPrice = defaultPrice { body["default_unit_price"] = defaultPrice }

        let _: ClientCreateResponse = try await apiClient.post("/api/admin/invoices/line-item-labels", body: body)
    }

    func updateLabel(_ id: Int, name: String, defaultPrice: Double? = nil) async throws {
        var body: [String: Any] = ["label_name": name]
        if let defaultPrice = defaultPrice { body["default_unit_price"] = defaultPrice }

        let _: ClientUpdateResponse = try await apiClient.put("/api/admin/invoices/line-item-labels/\(id)", body: body)
    }

    func deleteLabel(_ id: Int) async throws {
        let _: InvoiceMessageResponse = try await apiClient.delete("/api/admin/invoices/line-item-labels/\(id)")
    }

    // MARK: - Communications

    func sendEmail(invoiceId: Int, message: String? = nil, ccSelf: Bool = false, additionalEmails: [String]? = nil) async throws {
        var body: [String: Any] = [
            "ccSelf": ccSelf
        ]
        if let message = message { body["message"] = message }
        if let additionalEmails = additionalEmails { body["additionalEmails"] = additionalEmails }

        let _: InvoiceMessageResponse = try await apiClient.post(
            "/api/admin/invoices/\(invoiceId)/send-email",
            body: body
        )
    }

    func sendSMS(invoiceId: Int, message: String? = nil, phoneOverride: String? = nil) async throws {
        var body: [String: Any] = [:]
        if let message = message { body["message"] = message }
        if let phoneOverride = phoneOverride { body["phoneOverride"] = phoneOverride }

        let _: InvoiceMessageResponse = try await apiClient.post(
            "/api/admin/invoices/\(invoiceId)/send-sms",
            body: body
        )
    }

    // MARK: - Tracking

    func getTrackingData() async throws -> [Invoice] {
        return try await apiClient.get("/api/admin/invoices/tracking")
    }

    // MARK: - Receipt

    func downloadReceiptPDF(invoiceId: Int, paymentId: Int, language: String = "en") async throws -> Data {
        let url = URL(string: "\(APIConfig.baseURL)/api/admin/invoices/\(invoiceId)/payments/\(paymentId)/receipt/pdf?lang=\(language)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        if let accessToken = try? KeychainService.shared.get(for: "access_token") {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw NSError(domain: "InvoicesService", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Failed to download receipt PDF"])
        }

        return data
    }

    func sendReceipt(invoiceId: Int, paymentId: Int, recipients: [String], language: String = "en", sendVia: String = "email") async throws {
        let body: [String: Any] = [
            "recipients": recipients,
            "language": language,
            "send_via": sendVia
        ]
        let _: InvoiceMessageResponse = try await apiClient.post(
            "/api/admin/invoices/\(invoiceId)/payments/\(paymentId)/receipt/send",
            body: body
        )
    }

    // MARK: - PDF Download

    func downloadInvoicePDF(token: String) async throws -> Data {
        let url = URL(string: "\(APIConfig.baseURL)/invoice/\(token)/pdf")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        if let accessToken = try? KeychainService.shared.get(for: "access_token") {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw NSError(domain: "InvoicesService", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Failed to download invoice PDF"])
        }

        return data
    }
}
