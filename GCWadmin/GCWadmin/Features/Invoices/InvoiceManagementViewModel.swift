//
//  InvoiceManagementViewModel.swift
//  GCWadmin
//
//  ViewModel for Invoice Management
//

import Foundation
import SwiftUI
import UIKit
import Combine

// MARK: - Helper Struct

struct EditableLineItem: Identifiable {
    let id = UUID()
    var title: String = ""
    var description: String = ""
    var quantity: Double = 1
    var unitPrice: Double = 0

    var lineTotal: Double { quantity * unitPrice }
}

// MARK: - ViewModel

@MainActor
class InvoiceManagementViewModel: ObservableObject {
    private let invoicesService = InvoicesService.shared

    // MARK: - Published Properties - Data

    @Published var invoices: [Invoice] = []
    @Published var clients: [Client] = []
    @Published var taxRates: [TaxRate] = []
    @Published var labels: [LineItemLabel] = []
    @Published var selectedInvoice: InvoiceDetail?
    @Published var selectedClient: Client?

    // MARK: - Published Properties - View State

    @Published var activeView: String = "list"
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var successMessage: String?
    @Published var searchText: String = ""

    // MARK: - Published Properties - Invoice Detail

    @Published var showingInvoiceDetail = false
    @Published var showingPaymentForm = false
    @Published var showingEmailForm = false
    @Published var showingSMSForm = false

    // MARK: - Published Properties - Create/Edit Invoice Form

    @Published var editingInvoiceId: Int?
    @Published var formClientId: Int?
    @Published var formInvoiceDate = Date()
    @Published var formDueDate = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
    @Published var formTaxRate: Double = 0
    @Published var formDiscount: Double = 0
    @Published var formMarkup: Double = 0
    @Published var formClientNotes: String = ""
    @Published var formAdminNotes: String = ""
    @Published var formLineItems: [EditableLineItem] = []

    // MARK: - Published Properties - Client Form

    @Published var showingClientForm = false
    @Published var editingClientId: Int?
    @Published var clientFirstName: String = ""
    @Published var clientLastName: String = ""
    @Published var clientEmail: String = ""
    @Published var clientPhone: String = ""
    @Published var clientAddress: String = ""
    @Published var clientCompanyName: String = ""
    @Published var clientIsBusiness = false

    // MARK: - Published Properties - Payment Form

    @Published var paymentAmount: String = ""
    @Published var paymentMethod: String = "cash"
    @Published var paymentCheckNumber: String = ""
    @Published var paymentDate = Date()
    @Published var paymentNotes: String = ""
    @Published var editingPaymentId: Int?

    // MARK: - Published Properties - Send Receipt Form

    @Published var showingSendReceiptForm = false
    @Published var sendReceiptPayment: InvoicePayment?
    @Published var sendReceiptVia: String = "email"
    @Published var sendReceiptRecipient: String = ""
    @Published var sendReceiptLanguage: String = "en"

    // MARK: - Computed Properties

    var filteredInvoices: [Invoice] {
        guard !searchText.isEmpty else { return invoices }

        let query = searchText.lowercased()
        return invoices.filter { invoice in
            if invoice.invoiceNumber.lowercased().contains(query) {
                return true
            }
            if invoice.clientDisplayName.lowercased().contains(query) {
                return true
            }
            if invoice.status.lowercased().contains(query) {
                return true
            }
            return false
        }
    }

    var invoicesByStatus: [String: Int] {
        var counts: [String: Int] = [:]
        for invoice in invoices {
            counts[invoice.status, default: 0] += 1
        }
        return counts
    }

    var totalOutstanding: Double {
        invoices
            .filter { $0.status == "unpaid" || $0.status == "partial" }
            .reduce(0) { $0 + ($1.balanceDue ?? 0) }
    }

    // MARK: - Load All Data

    func loadAll() async {
        isLoading = true
        errorMessage = nil

        async let invoicesTask: () = loadInvoices()
        async let clientsTask: () = loadClients()
        async let taxRatesTask: () = loadTaxRates()
        async let labelsTask: () = loadLabels()

        _ = await (invoicesTask, clientsTask, taxRatesTask, labelsTask)

        isLoading = false
    }

    // MARK: - Load Invoices

    func loadInvoices() async {
        do {
            invoices = try await invoicesService.getAllInvoices()
            print("[Invoices] Loaded \(invoices.count) invoices")
        } catch {
            print("[Invoices] Error loading: \(error)")
        }
    }

    // MARK: - Load Clients

    func loadClients() async {
        do {
            clients = try await invoicesService.getAllClients()
            print("[Invoices] Loaded \(clients.count) clients")
        } catch {
            print("[Invoices] Error loading clients: \(error)")
        }
    }

    // MARK: - Load Tax Rates

    func loadTaxRates() async {
        do {
            taxRates = try await invoicesService.getAllTaxRates()
            print("[Invoices] Loaded \(taxRates.count) tax rates")
        } catch {
            print("[Invoices] Error loading tax rates: \(error)")
        }
    }

    // MARK: - Load Labels

    func loadLabels() async {
        do {
            labels = try await invoicesService.getAllLabels()
            print("[Invoices] Loaded \(labels.count) labels")
        } catch {
            print("[Invoices] Error loading labels: \(error)")
        }
    }

    // MARK: - View Invoice Detail

    func viewInvoice(_ invoice: Invoice) async {
        do {
            selectedInvoice = try await invoicesService.getInvoice(invoice.id)
            showingInvoiceDetail = true
        } catch {
            errorMessage = "Failed to load invoice details: \(error.localizedDescription)"
        }
    }

    // MARK: - Create Invoice

    func createInvoice() async {
        guard let clientId = formClientId else {
            errorMessage = "Please select a client"
            return
        }

        isSaving = true
        errorMessage = nil

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        let lineItems: [[String: Any]] = formLineItems.map { item in
            [
                "title": item.title,
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unitPrice,
                "total_price": item.quantity * item.unitPrice
            ]
        }

        let totals = calculateFormTotals()

        let body: [String: Any] = [
            "client_id": clientId,
            "invoice_date": dateFormatter.string(from: formInvoiceDate),
            "due_date": dateFormatter.string(from: formDueDate),
            "tax_rate": formTaxRate,
            "tax_amount": totals.tax,
            "discount_amount": formDiscount,
            "markup_amount": formMarkup,
            "subtotal": totals.subtotal,
            "total_amount": totals.total,
            "client_notes": formClientNotes,
            "admin_notes": formAdminNotes,
            "line_items": lineItems
        ]

        do {
            let response = try await invoicesService.createInvoice(body)
            await loadInvoices()
            // Load the full invoice detail to show
            if let detail = try? await invoicesService.getInvoice(response.id) {
                selectedInvoice = detail
                activeView = "view"
            } else {
                activeView = "list"
            }
            successMessage = "Invoice created successfully"
        } catch {
            errorMessage = "Failed to create invoice: \(error.localizedDescription)"
        }

        isSaving = false
    }

    // MARK: - Update Invoice

    func updateInvoice() async {
        guard let invoiceId = editingInvoiceId else {
            errorMessage = "No invoice selected for editing"
            return
        }
        guard let clientId = formClientId else {
            errorMessage = "Please select a client"
            return
        }

        isSaving = true
        errorMessage = nil

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        let lineItems: [[String: Any]] = formLineItems.map { item in
            [
                "title": item.title,
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unitPrice,
                "total_price": item.quantity * item.unitPrice
            ]
        }

        let totals = calculateFormTotals()

        let body: [String: Any] = [
            "client_id": clientId,
            "invoice_date": dateFormatter.string(from: formInvoiceDate),
            "due_date": dateFormatter.string(from: formDueDate),
            "tax_rate": formTaxRate,
            "tax_amount": totals.tax,
            "discount_amount": formDiscount,
            "markup_amount": formMarkup,
            "subtotal": totals.subtotal,
            "total_amount": totals.total,
            "client_notes": formClientNotes,
            "admin_notes": formAdminNotes,
            "line_items": lineItems
        ]

        do {
            let detail = try await invoicesService.updateInvoice(invoiceId, body: body)
            selectedInvoice = detail
            await loadInvoices()
            activeView = "view"
            successMessage = "Invoice updated successfully"
        } catch {
            errorMessage = "Failed to update invoice: \(error.localizedDescription)"
        }

        isSaving = false
    }

    // MARK: - Delete Invoice

    func deleteInvoice(_ invoice: Invoice) async {
        do {
            try await invoicesService.deleteInvoice(invoice.id)
            await loadInvoices()
            showingInvoiceDetail = false
            selectedInvoice = nil
            activeView = "list"
            successMessage = "Invoice deleted"
        } catch {
            errorMessage = "Failed to delete invoice: \(error.localizedDescription)"
        }
    }

    // MARK: - Invoice Form Helpers

    func prepareNewInvoice() {
        editingInvoiceId = nil
        formClientId = nil
        formInvoiceDate = Date()
        formDueDate = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
        formTaxRate = 0
        formDiscount = 0
        formMarkup = 0
        formClientNotes = ""
        formAdminNotes = ""
        formLineItems = [EditableLineItem()]
        activeView = "create"
    }

    func prepareEditInvoice(_ detail: InvoiceDetail) {
        editingInvoiceId = detail.id
        formClientId = detail.clientId

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        if let invoiceDateStr = detail.invoiceDate,
           let date = dateFormatter.date(from: invoiceDateStr) {
            formInvoiceDate = date
        } else {
            formInvoiceDate = Date()
        }

        if let dueDateStr = detail.dueDate,
           let date = dateFormatter.date(from: dueDateStr) {
            formDueDate = date
        } else {
            formDueDate = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
        }

        formTaxRate = detail.taxRate ?? 0
        formDiscount = detail.discountAmount ?? 0
        formMarkup = detail.markupAmount ?? 0
        formClientNotes = detail.clientNotes ?? ""
        formAdminNotes = detail.adminNotes ?? ""

        formLineItems = (detail.lineItems ?? []).map { item in
            var editable = EditableLineItem()
            editable.title = item.title ?? ""
            editable.description = item.description
            editable.quantity = item.quantity
            editable.unitPrice = item.unitPrice
            return editable
        }

        if formLineItems.isEmpty {
            formLineItems = [EditableLineItem()]
        }

        activeView = "create"
    }

    func addLineItem() {
        formLineItems.append(EditableLineItem())
    }

    func removeLineItem(at offsets: IndexSet) {
        formLineItems.remove(atOffsets: offsets)
    }

    func calculateFormTotals() -> (subtotal: Double, tax: Double, total: Double) {
        let subtotal = formLineItems.reduce(0) { $0 + $1.lineTotal }
        let afterMarkup = subtotal * (1 + formMarkup / 100)
        let afterDiscount = afterMarkup - formDiscount
        let tax = afterDiscount * (formTaxRate / 100)
        let total = afterDiscount + tax
        return (subtotal: subtotal, tax: tax, total: total)
    }

    // MARK: - Payments

    func addPayment() async {
        // If editing an existing payment, delegate to updatePayment
        if editingPaymentId != nil {
            await updatePayment()
            return
        }

        guard let invoiceId = selectedInvoice?.id else {
            errorMessage = "No invoice selected"
            return
        }
        guard let amount = Double(paymentAmount), amount > 0 else {
            errorMessage = "Please enter a valid payment amount"
            return
        }

        isSaving = true
        errorMessage = nil

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        do {
            try await invoicesService.addPayment(
                invoiceId: invoiceId,
                amount: amount,
                method: paymentMethod,
                checkNumber: paymentCheckNumber.isEmpty ? nil : paymentCheckNumber,
                date: dateFormatter.string(from: paymentDate),
                notes: paymentNotes.isEmpty ? nil : paymentNotes
            )

            // Reload the invoice detail
            selectedInvoice = try await invoicesService.getInvoice(invoiceId)
            await loadInvoices()

            // Reset payment form
            paymentAmount = ""
            paymentMethod = "cash"
            paymentCheckNumber = ""
            paymentDate = Date()
            paymentNotes = ""
            editingPaymentId = nil
            showingPaymentForm = false

            successMessage = "Payment recorded"
        } catch {
            errorMessage = "Failed to add payment: \(error.localizedDescription)"
        }

        isSaving = false
    }

    func deletePayment(_ payment: InvoicePayment) async {
        guard let invoiceId = selectedInvoice?.id else { return }

        do {
            try await invoicesService.deletePayment(payment.id)
            selectedInvoice = try await invoicesService.getInvoice(invoiceId)
            await loadInvoices()
            successMessage = "Payment deleted"
        } catch {
            errorMessage = "Failed to delete payment: \(error.localizedDescription)"
        }
    }

    func prepareEditPayment(_ payment: InvoicePayment) {
        editingPaymentId = payment.id
        paymentAmount = String(format: "%.2f", payment.paymentAmount)
        paymentMethod = payment.paymentMethod ?? "cash"
        paymentCheckNumber = payment.checkNumber ?? ""
        paymentNotes = payment.notes ?? ""

        // Parse payment date
        if let dateStr = payment.paymentDate {
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            if let date = dateFormatter.date(from: dateStr) {
                paymentDate = date
            } else {
                // Try ISO8601 format
                let iso = ISO8601DateFormatter()
                iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let date = iso.date(from: dateStr) {
                    paymentDate = date
                } else {
                    paymentDate = Date()
                }
            }
        } else {
            paymentDate = Date()
        }

        showingPaymentForm = true
    }

    func updatePayment() async {
        guard let paymentId = editingPaymentId,
              let invoiceId = selectedInvoice?.id else {
            errorMessage = "No payment selected for editing"
            return
        }
        guard let amount = Double(paymentAmount), amount > 0 else {
            errorMessage = "Please enter a valid payment amount"
            return
        }

        isSaving = true
        errorMessage = nil

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        do {
            try await invoicesService.updatePayment(
                paymentId,
                amount: amount,
                method: paymentMethod,
                checkNumber: paymentCheckNumber.isEmpty ? nil : paymentCheckNumber,
                date: dateFormatter.string(from: paymentDate),
                notes: paymentNotes.isEmpty ? nil : paymentNotes
            )

            // Reload the invoice detail
            selectedInvoice = try await invoicesService.getInvoice(invoiceId)
            await loadInvoices()

            // Reset payment form
            paymentAmount = ""
            paymentMethod = "cash"
            paymentCheckNumber = ""
            paymentDate = Date()
            paymentNotes = ""
            editingPaymentId = nil
            showingPaymentForm = false

            successMessage = "Payment updated"
        } catch {
            errorMessage = "Failed to update payment: \(error.localizedDescription)"
        }

        isSaving = false
    }

    func downloadReceiptPDF(_ payment: InvoicePayment) async {
        guard let invoiceId = selectedInvoice?.id else { return }

        do {
            let data = try await invoicesService.downloadReceiptPDF(invoiceId: invoiceId, paymentId: payment.id)

            // Save to temp file and share
            let fileName = "receipt-\(payment.id).pdf"
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
            try data.write(to: tempURL)

            await MainActor.run {
                let activityVC = UIActivityViewController(
                    activityItems: [tempURL],
                    applicationActivities: nil
                )

                if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                   let rootVC = windowScene.windows.first?.rootViewController {
                    // Handle iPad popover
                    if let popover = activityVC.popoverPresentationController {
                        popover.sourceView = rootVC.view
                        popover.sourceRect = CGRect(x: rootVC.view.bounds.midX, y: rootVC.view.bounds.midY, width: 0, height: 0)
                        popover.permittedArrowDirections = []
                    }
                    rootVC.present(activityVC, animated: true)
                }
            }
        } catch {
            errorMessage = "Failed to download receipt: \(error.localizedDescription)"
        }
    }

    func prepareSendReceipt(_ payment: InvoicePayment) {
        sendReceiptPayment = payment
        sendReceiptVia = "email"
        sendReceiptLanguage = "en"

        // Pre-fill recipient from client info
        if let email = selectedInvoice?.email, !email.isEmpty {
            sendReceiptRecipient = email
        } else {
            sendReceiptRecipient = ""
        }

        showingSendReceiptForm = true
    }

    func sendReceipt() async {
        guard let invoiceId = selectedInvoice?.id,
              let payment = sendReceiptPayment else {
            errorMessage = "No payment selected"
            return
        }
        guard !sendReceiptRecipient.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please enter a recipient"
            return
        }

        isSaving = true
        errorMessage = nil

        do {
            try await invoicesService.sendReceipt(
                invoiceId: invoiceId,
                paymentId: payment.id,
                recipients: [sendReceiptRecipient.trimmingCharacters(in: .whitespaces)],
                language: sendReceiptLanguage,
                sendVia: sendReceiptVia
            )

            showingSendReceiptForm = false
            sendReceiptPayment = nil
            sendReceiptRecipient = ""
            successMessage = "Receipt sent successfully"
        } catch {
            errorMessage = "Failed to send receipt: \(error.localizedDescription)"
        }

        isSaving = false
    }

    // MARK: - Clients

    func prepareNewClient() {
        editingClientId = nil
        clientFirstName = ""
        clientLastName = ""
        clientEmail = ""
        clientPhone = ""
        clientAddress = ""
        clientCompanyName = ""
        clientIsBusiness = false
        showingClientForm = true
    }

    func prepareEditClient(_ client: Client) {
        editingClientId = client.id
        clientFirstName = client.firstName
        clientLastName = client.lastName
        clientEmail = client.email ?? ""
        clientPhone = client.phone ?? ""
        clientAddress = client.address ?? ""
        clientCompanyName = client.companyName ?? ""
        clientIsBusiness = client.isBusiness
        showingClientForm = true
    }

    func saveClient() async {
        guard !clientFirstName.isEmpty, !clientLastName.isEmpty else {
            errorMessage = "First name and last name are required"
            return
        }

        isSaving = true
        errorMessage = nil

        do {
            if let clientId = editingClientId {
                try await invoicesService.updateClient(
                    clientId,
                    firstName: clientFirstName,
                    lastName: clientLastName,
                    email: clientEmail.isEmpty ? nil : clientEmail,
                    phone: clientPhone.isEmpty ? nil : clientPhone,
                    address: clientAddress.isEmpty ? nil : clientAddress,
                    companyName: clientCompanyName.isEmpty ? nil : clientCompanyName,
                    isBusiness: clientIsBusiness
                )
                // Reload clients to get updated data from server
                await loadClients()
                successMessage = "Client updated"
            } else {
                let response = try await invoicesService.createClient(
                    firstName: clientFirstName,
                    lastName: clientLastName,
                    email: clientEmail.isEmpty ? nil : clientEmail,
                    phone: clientPhone.isEmpty ? nil : clientPhone,
                    address: clientAddress.isEmpty ? nil : clientAddress,
                    companyName: clientCompanyName.isEmpty ? nil : clientCompanyName,
                    isBusiness: clientIsBusiness
                )
                // Reload clients to get the full client object from server
                await loadClients()
                // Auto-select the newly created client
                formClientId = response.id
                successMessage = "Client created"
            }

            showingClientForm = false
        } catch {
            errorMessage = "Failed to save client: \(error.localizedDescription)"
        }

        isSaving = false
    }

    func deleteClient(_ client: Client) async {
        do {
            try await invoicesService.deleteClient(client.id)
            clients.removeAll { $0.id == client.id }
            successMessage = "Client deleted"
        } catch {
            errorMessage = "Failed to delete client: \(error.localizedDescription)"
        }
    }

    // MARK: - Communications

    func sendEmail(message: String? = nil, ccSelf: Bool = false) async {
        guard let invoiceId = selectedInvoice?.id else {
            errorMessage = "No invoice selected"
            return
        }

        isSaving = true
        errorMessage = nil

        do {
            try await invoicesService.sendEmail(
                invoiceId: invoiceId,
                message: message,
                ccSelf: ccSelf
            )
            showingEmailForm = false
            successMessage = "Email sent successfully"
        } catch {
            errorMessage = "Failed to send email: \(error.localizedDescription)"
        }

        isSaving = false
    }

    func sendSMS(message: String? = nil, phoneOverride: String? = nil) async {
        guard let invoiceId = selectedInvoice?.id else {
            errorMessage = "No invoice selected"
            return
        }

        isSaving = true
        errorMessage = nil

        do {
            try await invoicesService.sendSMS(
                invoiceId: invoiceId,
                message: message,
                phoneOverride: phoneOverride
            )
            showingSMSForm = false
            successMessage = "SMS sent successfully"
        } catch {
            errorMessage = "Failed to send SMS: \(error.localizedDescription)"
        }

        isSaving = false
    }

    // MARK: - Tax Rates

    func createTaxRate(city: String, stateCode: String? = nil, rate: Double, description: String? = nil) async {
        isSaving = true
        errorMessage = nil

        do {
            try await invoicesService.createTaxRate(
                city: city,
                stateCode: stateCode,
                taxRate: rate,
                description: description
            )
            await loadTaxRates()
            successMessage = "Tax rate created"
        } catch {
            errorMessage = "Failed to create tax rate: \(error.localizedDescription)"
        }

        isSaving = false
    }

    func deleteTaxRate(_ taxRate: TaxRate) async {
        do {
            try await invoicesService.deleteTaxRate(taxRate.id)
            taxRates.removeAll { $0.id == taxRate.id }
            successMessage = "Tax rate deleted"
        } catch {
            errorMessage = "Failed to delete tax rate: \(error.localizedDescription)"
        }
    }

    // MARK: - Labels

    func createLabel(name: String, defaultPrice: Double? = nil) async {
        isSaving = true
        errorMessage = nil

        do {
            try await invoicesService.createLabel(name: name, defaultPrice: defaultPrice)
            await loadLabels()
            successMessage = "Label created"
        } catch {
            errorMessage = "Failed to create label: \(error.localizedDescription)"
        }

        isSaving = false
    }

    func deleteLabel(_ label: LineItemLabel) async {
        do {
            try await invoicesService.deleteLabel(label.id)
            labels.removeAll { $0.id == label.id }
            successMessage = "Label deleted"
        } catch {
            errorMessage = "Failed to delete label: \(error.localizedDescription)"
        }
    }

    // MARK: - Format Date

    func formatDate(_ dateString: String?) -> String {
        guard let dateString = dateString else { return "N/A" }

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short

        if let date = isoFormatter.date(from: dateString) {
            return displayFormatter.string(from: date)
        }

        let altFormatter = DateFormatter()
        altFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        if let date = altFormatter.date(from: dateString) {
            return displayFormatter.string(from: date)
        }

        altFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        if let date = altFormatter.date(from: dateString) {
            return displayFormatter.string(from: date)
        }

        altFormatter.dateFormat = "yyyy-MM-dd"
        if let date = altFormatter.date(from: dateString) {
            displayFormatter.timeStyle = .none
            return displayFormatter.string(from: date)
        }

        return dateString
    }

    // MARK: - Format Currency

    func formatCurrency(_ amount: Double?) -> String {
        guard let amount = amount else { return "$0.00" }

        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }
}
