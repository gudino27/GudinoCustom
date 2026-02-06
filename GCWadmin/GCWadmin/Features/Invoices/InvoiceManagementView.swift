//
//  InvoiceManagementView.swift
//  GCWadmin
//
//  Invoice Management UI - matches webapp InvoiceManager component
//

import SwiftUI

struct InvoiceManagementView: View {
    @StateObject private var viewModel = InvoiceManagementViewModel()
    @State private var activeTab = "invoices"
    @State private var showDeleteInvoiceConfirmation = false
    @State private var invoiceToDelete: Invoice?
    @State private var showDeleteClientConfirmation = false
    @State private var clientToDelete: Client?
    @State private var showDeleteTaxRateConfirmation = false
    @State private var taxRateToDelete: TaxRate?
    @State private var showDeleteLabelConfirmation = false
    @State private var labelToDelete: LineItemLabel?
    @State private var showDeletePaymentConfirmation = false
    @State private var paymentToDelete: InvoicePayment?

    // Tax Rate Form
    @State private var showTaxRateForm = false
    @State private var taxRateStateCode = ""
    @State private var taxRateCity = ""
    @State private var taxRateValue = ""
    @State private var taxRateDescription = ""

    // Label Form
    @State private var showLabelForm = false
    @State private var labelName = ""
    @State private var labelDefaultPrice = ""

    var body: some View {
        Group {
            switch viewModel.activeView {
            case "create":
                createEditInvoiceView
            case "view":
                if let detail = viewModel.selectedInvoice {
                    invoiceDetailView(detail)
                } else {
                    mainListView
                }
            default:
                mainListView
            }
        }
        .background(AppColors.background)
        .navigationTitle("Invoice Manager")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadAll()
        }
        .sheet(isPresented: $viewModel.showingInvoiceDetail) {
            if let detail = viewModel.selectedInvoice {
                InvoiceDetailSheet(
                    detail: detail,
                    viewModel: viewModel,
                    onDismiss: { viewModel.showingInvoiceDetail = false },
                    onEdit: {
                        viewModel.showingInvoiceDetail = false
                        viewModel.prepareEditInvoice(detail)
                    },
                    onDelete: {
                        // Create a temporary Invoice from detail for deletion
                        let tempInvoice = Invoice.stub(id: detail.id, invoiceNumber: detail.invoiceNumber)
                        invoiceToDelete = tempInvoice
                        showDeleteInvoiceConfirmation = true
                    }
                )
            }
        }
        .sheet(isPresented: $viewModel.showingClientForm) {
            ClientFormSheet(viewModel: viewModel)
        }
        .sheet(isPresented: $showTaxRateForm) {
            TaxRateFormSheet(
                stateCode: $taxRateStateCode,
                city: $taxRateCity,
                rate: $taxRateValue,
                description: $taxRateDescription,
                isSaving: viewModel.isSaving,
                onSave: {
                    guard let rate = Double(taxRateValue) else {
                        viewModel.errorMessage = "Please enter a valid rate"
                        return
                    }
                    guard !taxRateCity.isEmpty else {
                        viewModel.errorMessage = "City is required"
                        return
                    }
                    Task {
                        await viewModel.createTaxRate(
                            city: taxRateCity,
                            stateCode: taxRateStateCode.isEmpty ? nil : taxRateStateCode,
                            rate: rate,
                            description: taxRateDescription.isEmpty ? nil : taxRateDescription
                        )
                        showTaxRateForm = false
                        taxRateStateCode = ""
                        taxRateCity = ""
                        taxRateValue = ""
                        taxRateDescription = ""
                    }
                },
                onCancel: { showTaxRateForm = false }
            )
        }
        .sheet(isPresented: $showLabelForm) {
            LabelFormSheet(
                name: $labelName,
                defaultPrice: $labelDefaultPrice,
                isSaving: viewModel.isSaving,
                onSave: {
                    guard !labelName.isEmpty else {
                        viewModel.errorMessage = "Please enter a label name"
                        return
                    }
                    Task {
                        await viewModel.createLabel(
                            name: labelName,
                            defaultPrice: labelDefaultPrice.isEmpty ? nil : Double(labelDefaultPrice)
                        )
                        showLabelForm = false
                        labelName = ""
                        labelDefaultPrice = ""
                    }
                },
                onCancel: { showLabelForm = false }
            )
        }
        .alert("Delete Invoice", isPresented: $showDeleteInvoiceConfirmation, presenting: invoiceToDelete) { invoice in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteInvoice(invoice) }
            }
        } message: { invoice in
            Text("Are you sure you want to delete invoice \(invoice.invoiceNumber)? This cannot be undone.")
        }
        .alert("Delete Client", isPresented: $showDeleteClientConfirmation, presenting: clientToDelete) { client in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteClient(client) }
            }
        } message: { client in
            Text("Are you sure you want to delete \(client.displayName)? This cannot be undone.")
        }
        .alert("Delete Tax Rate", isPresented: $showDeleteTaxRateConfirmation, presenting: taxRateToDelete) { taxRate in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteTaxRate(taxRate) }
            }
        } message: { taxRate in
            Text("Are you sure you want to delete the tax rate for \(taxRate.city)?")
        }
        .alert("Delete Label", isPresented: $showDeleteLabelConfirmation, presenting: labelToDelete) { label in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteLabel(label) }
            }
        } message: { label in
            Text("Are you sure you want to delete the label \"\(label.labelName)\"?")
        }
        .alert("Delete Payment", isPresented: $showDeletePaymentConfirmation, presenting: paymentToDelete) { payment in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deletePayment(payment) }
            }
        } message: { _ in
            Text("Are you sure you want to delete this payment?")
        }
        .overlay(alignment: .top) {
            notificationOverlay
        }
    }

    // MARK: - Main List View

    private var mainListView: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Tab bar
                viewTypeTabs

                // Content based on tab
                switch activeTab {
                case "clients":
                    clientsSection
                case "taxRates":
                    taxRatesSection
                case "labels":
                    labelsSection
                default:
                    invoicesSection
                }
            }
            .padding(AppSpacing.lg)
        }
    }

    // MARK: - View Type Tabs

    private var viewTypeTabs: some View {
        HStack(spacing: 0) {
            viewTypeTab("Invoices", value: "invoices", count: viewModel.invoices.count)
            viewTypeTab("Clients", value: "clients", count: viewModel.clients.count)
            viewTypeTab("Tax Rates", value: "taxRates", count: viewModel.taxRates.count)
            viewTypeTab("Labels", value: "labels", count: viewModel.labels.count)
        }
        .background(AppColors.gray200)
        .cornerRadius(8)
    }

    private func viewTypeTab(_ label: String, value: String, count: Int) -> some View {
        Button(action: { activeTab = value }) {
            VStack(spacing: 2) {
                Text(label)
                    .font(.body)
                    .fontWeight(activeTab == value ? .semibold : .regular)
                Text("\(count)")
                    .font(.system(size: 14))
                    .foregroundColor(activeTab == value ? AppColors.blue : AppColors.textGray)
            }
            .foregroundColor(activeTab == value ? AppColors.text : AppColors.textGray)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(activeTab == value ? Color.white : Color.clear)
            .cornerRadius(8)
        }
    }

    // MARK: - Invoices Section

    private var invoicesSection: some View {
        VStack(spacing: AppSpacing.md) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 16))
                        .foregroundColor(AppColors.blue)
                    Text("Invoices")
                        .font(.headline)
                        .foregroundColor(AppColors.text)
                }
                Spacer()
                Button(action: { viewModel.prepareNewInvoice() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.system(size: 15))
                        Text("New Invoice")
                            .font(.body)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(AppColors.blue)
                    .cornerRadius(6)
                }
            }

            // Search bar
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 16))
                    .foregroundColor(AppColors.textGray)
                TextField("Search invoices...", text: $viewModel.searchText)
                    .font(.body)
                if !viewModel.searchText.isEmpty {
                    Button(action: { viewModel.searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundColor(AppColors.textGray)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.white)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(AppColors.border, lineWidth: 1)
            )

            // Status summary badges
            invoiceStatusBadges

            // Invoice list
            if viewModel.isLoading && viewModel.invoices.isEmpty {
                loadingState("Loading invoices...")
            } else if viewModel.filteredInvoices.isEmpty {
                emptyState(icon: "doc.text", title: "No invoices found", subtitle: "Create your first invoice to get started.")
            } else {
                ForEach(viewModel.filteredInvoices) { invoice in
                    InvoiceCard(
                        invoice: invoice,
                        viewModel: viewModel,
                        onView: { Task { await viewModel.viewInvoice(invoice) } },
                        onDelete: {
                            invoiceToDelete = invoice
                            showDeleteInvoiceConfirmation = true
                        }
                    )
                }
            }
        }
    }

    private var invoiceStatusBadges: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                statusBadge(
                    label: "Draft",
                    count: viewModel.invoicesByStatus["draft"] ?? 0,
                    color: AppColors.gray500,
                    bgColor: AppColors.gray50
                )
                statusBadge(
                    label: "Unpaid",
                    count: viewModel.invoicesByStatus["unpaid"] ?? 0,
                    color: AppColors.error,
                    bgColor: AppColors.errorBg
                )
                statusBadge(
                    label: "Partial",
                    count: viewModel.invoicesByStatus["partial"] ?? 0,
                    color: AppColors.warningMedium,
                    bgColor: AppColors.warningBg
                )
                statusBadge(
                    label: "Paid",
                    count: viewModel.invoicesByStatus["paid"] ?? 0,
                    color: AppColors.success,
                    bgColor: AppColors.successBg
                )
                // Total outstanding
                VStack(spacing: 2) {
                    Text("Outstanding")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.textGray)
                    Text(viewModel.formatCurrency(viewModel.totalOutstanding))
                        .font(.body)
                        .fontWeight(.bold)
                        .foregroundColor(AppColors.error)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(AppColors.errorBg)
                .cornerRadius(6)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(AppColors.errorBorder, lineWidth: 1)
                )
            }
        }
    }

    private func statusBadge(label: String, count: Int, color: Color, bgColor: Color) -> some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.system(size: 14))
                .foregroundColor(color)
            Text("\(count)")
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(color)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(bgColor)
        .cornerRadius(6)
    }

    // MARK: - Clients Section

    private var clientsSection: some View {
        VStack(spacing: AppSpacing.md) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "person.2")
                        .font(.system(size: 16))
                        .foregroundColor(AppColors.blue)
                    Text("Clients")
                        .font(.headline)
                        .foregroundColor(AppColors.text)
                }
                Spacer()
                Button(action: { viewModel.prepareNewClient() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.system(size: 15))
                        Text("Add Client")
                            .font(.body)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(AppColors.blue)
                    .cornerRadius(6)
                }
            }

            if viewModel.isLoading && viewModel.clients.isEmpty {
                loadingState("Loading clients...")
            } else if viewModel.clients.isEmpty {
                emptyState(icon: "person.2", title: "No clients yet", subtitle: "Add your first client to start creating invoices.")
            } else {
                ForEach(viewModel.clients) { client in
                    ClientCard(
                        client: client,
                        onEdit: { viewModel.prepareEditClient(client) },
                        onDelete: {
                            clientToDelete = client
                            showDeleteClientConfirmation = true
                        }
                    )
                }
            }
        }
    }

    // MARK: - Tax Rates Section

    private var taxRatesSection: some View {
        VStack(spacing: AppSpacing.md) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "percent")
                        .font(.system(size: 16))
                        .foregroundColor(AppColors.blue)
                    Text("Tax Rates")
                        .font(.headline)
                        .foregroundColor(AppColors.text)
                }
                Spacer()
                Button(action: { showTaxRateForm = true }) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.system(size: 15))
                        Text("Add Tax Rate")
                            .font(.body)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(AppColors.blue)
                    .cornerRadius(6)
                }
            }

            if viewModel.isLoading && viewModel.taxRates.isEmpty {
                loadingState("Loading tax rates...")
            } else if viewModel.taxRates.isEmpty {
                emptyState(icon: "percent", title: "No tax rates", subtitle: "Add tax rates for your service areas.")
            } else {
                ForEach(viewModel.taxRates) { taxRate in
                    TaxRateCard(
                        taxRate: taxRate,
                        onDelete: {
                            taxRateToDelete = taxRate
                            showDeleteTaxRateConfirmation = true
                        }
                    )
                }
            }
        }
    }

    // MARK: - Labels Section

    private var labelsSection: some View {
        VStack(spacing: AppSpacing.md) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "tag")
                        .font(.system(size: 16))
                        .foregroundColor(AppColors.blue)
                    Text("Line Item Labels")
                        .font(.headline)
                        .foregroundColor(AppColors.text)
                }
                Spacer()
                Button(action: { showLabelForm = true }) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.system(size: 15))
                        Text("Add Label")
                            .font(.body)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(AppColors.blue)
                    .cornerRadius(6)
                }
            }

            if viewModel.isLoading && viewModel.labels.isEmpty {
                loadingState("Loading labels...")
            } else if viewModel.labels.isEmpty {
                emptyState(icon: "tag", title: "No labels", subtitle: "Add labels for commonly used line items.")
            } else {
                ForEach(viewModel.labels) { label in
                    LabelCard(
                        label: label,
                        viewModel: viewModel,
                        onDelete: {
                            labelToDelete = label
                            showDeleteLabelConfirmation = true
                        }
                    )
                }
            }
        }
    }

    // MARK: - Create/Edit Invoice View

    private var createEditInvoiceView: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Header
                HStack {
                    Button(action: { viewModel.activeView = "list" }) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 16))
                            Text("Back")
                                .font(.body)
                        }
                        .foregroundColor(AppColors.blue)
                    }
                    Spacer()
                    Text(viewModel.editingInvoiceId != nil ? "Edit Invoice" : "New Invoice")
                        .font(.headline)
                        .foregroundColor(AppColors.text)
                    Spacer()
                    // Spacer for symmetry
                    Color.clear.frame(width: 60, height: 1)
                }

                // Client picker
                clientPickerSection

                // Dates
                datesSection

                // Line items
                lineItemsSection

                // Adjustments
                adjustmentsSection

                // Live totals
                formTotalsSection

                // Notes
                notesSection

                // Save button
                Button(action: {
                    Task {
                        if viewModel.editingInvoiceId != nil {
                            await viewModel.updateInvoice()
                        } else {
                            await viewModel.createInvoice()
                        }
                    }
                }) {
                    HStack(spacing: 8) {
                        if viewModel.isSaving {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.8)
                        }
                        Text(viewModel.editingInvoiceId != nil ? "Update Invoice" : "Create Invoice")
                            .font(.body)
                            .fontWeight(.semibold)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppColors.blue)
                    .cornerRadius(8)
                }
                .disabled(viewModel.isSaving)
            }
            .padding(AppSpacing.lg)
        }
    }

    private var clientPickerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Client", icon: "person")

            if viewModel.clients.isEmpty {
                Text("No clients available.")
                    .font(.body)
                    .foregroundColor(AppColors.textGray)
            } else {
                Menu {
                    ForEach(viewModel.clients) { client in
                        Button(client.displayName) {
                            viewModel.formClientId = client.id
                        }
                    }
                } label: {
                    HStack {
                        Text(selectedClientName)
                            .font(.body)
                            .foregroundColor(viewModel.formClientId != nil ? AppColors.text : AppColors.textGray)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .font(.system(size: 15))
                            .foregroundColor(AppColors.textGray)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 12)
                    .background(Color.white)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(AppColors.border, lineWidth: 1)
                    )
                }
            }

            Button {
                viewModel.prepareNewClient()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 15))
                    Text("Add New Client")
                        .font(.subheadline.weight(.medium))
                }
                .foregroundColor(AppColors.blue)
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private var selectedClientName: String {
        if let clientId = viewModel.formClientId,
           let client = viewModel.clients.first(where: { $0.id == clientId }) {
            return client.displayName
        }
        return "Select a client..."
    }

    private var datesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Dates", icon: "calendar")

            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Invoice Date")
                        .font(.body)
                        .foregroundColor(AppColors.textGray)
                    DatePicker("", selection: $viewModel.formInvoiceDate, displayedComponents: .date)
                        .labelsHidden()
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Due Date")
                        .font(.body)
                        .foregroundColor(AppColors.textGray)
                    DatePicker("", selection: $viewModel.formDueDate, displayedComponents: .date)
                        .labelsHidden()
                }
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private var lineItemsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                sectionHeader("Line Items", icon: "list.bullet")
                Spacer()
                Button(action: { viewModel.addLineItem() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.system(size: 14))
                        Text("Add Item")
                            .font(.body)
                    }
                    .foregroundColor(AppColors.blue)
                }
            }

            ForEach(Array(viewModel.formLineItems.enumerated()), id: \.element.id) { index, _ in
                lineItemRow(index: index)
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private func lineItemRow(index: Int) -> some View {
        VStack(spacing: 8) {
            if index > 0 {
                Divider()
            }

            HStack(alignment: .top) {
                VStack(spacing: 6) {
                    // Title with label picker
                    Menu {
                        Button("Custom") {
                            // Keep current title
                        }
                        ForEach(viewModel.labels) { label in
                            Button(label.labelName) {
                                viewModel.formLineItems[index].title = label.labelName
                                if let price = label.defaultUnitPrice {
                                    viewModel.formLineItems[index].unitPrice = price
                                }
                            }
                        }
                    } label: {
                        HStack {
                            TextField("Title", text: $viewModel.formLineItems[index].title)
                                .font(.body)
                            Image(systemName: "chevron.down")
                                .font(.system(size: 14))
                                .foregroundColor(AppColors.textGray)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(AppColors.gray50)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
                    }

                    TextField("Description", text: $viewModel.formLineItems[index].description)
                        .font(.body)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(AppColors.gray50)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))

                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Qty").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                            TextField("1", value: $viewModel.formLineItems[index].quantity, format: .number)
                                .font(.body)
                                .keyboardType(.decimalPad)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 6)
                                .background(AppColors.gray50)
                                .cornerRadius(4)
                                .overlay(RoundedRectangle(cornerRadius: 4).stroke(AppColors.border, lineWidth: 1))
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Unit Price").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                            TextField("$0.00", value: $viewModel.formLineItems[index].unitPrice, format: .number)
                                .font(.body)
                                .keyboardType(.decimalPad)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 6)
                                .background(AppColors.gray50)
                                .cornerRadius(4)
                                .overlay(RoundedRectangle(cornerRadius: 4).stroke(AppColors.border, lineWidth: 1))
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Line Total").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                            Text(viewModel.formatCurrency(viewModel.formLineItems[index].lineTotal))
                                .font(.body)
                                .fontWeight(.semibold)
                                .foregroundColor(AppColors.text)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 6)
                        }
                    }
                }

                if viewModel.formLineItems.count > 1 {
                    Button(action: {
                        viewModel.formLineItems.remove(at: index)
                    }) {
                        Image(systemName: "trash")
                            .font(.system(size: 15))
                            .foregroundColor(AppColors.error)
                            .frame(width: 28, height: 28)
                            .background(AppColors.errorBg)
                            .cornerRadius(4)
                    }
                }
            }
        }
    }

    private var adjustmentsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Adjustments", icon: "slider.horizontal.3")

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Tax Rate %")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.textGray)

                    // Tax rate picker from saved rates
                    Menu {
                        Button("Custom") { }
                        ForEach(viewModel.taxRates) { rate in
                            Button("\(rate.city)\(rate.stateCode != nil ? " \(rate.stateCode!)" : "") - \(String(format: "%.2f", rate.taxRate))%") {
                                viewModel.formTaxRate = rate.taxRate
                            }
                        }
                    } label: {
                        HStack {
                            TextField("0", value: $viewModel.formTaxRate, format: .number)
                                .font(.body)
                                .keyboardType(.decimalPad)
                            Image(systemName: "chevron.down")
                                .font(.system(size: 14))
                                .foregroundColor(AppColors.textGray)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(AppColors.gray50)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Discount $")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.textGray)
                    TextField("0.00", value: $viewModel.formDiscount, format: .number)
                        .font(.body)
                        .keyboardType(.decimalPad)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(AppColors.gray50)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Markup %")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.textGray)
                    TextField("0", value: $viewModel.formMarkup, format: .number)
                        .font(.body)
                        .keyboardType(.decimalPad)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(AppColors.gray50)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
                }
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private var formTotalsSection: some View {
        let totals = viewModel.calculateFormTotals()

        return VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Totals", icon: "dollarsign.circle")

            VStack(spacing: 6) {
                totalRow("Subtotal", value: totals.subtotal)
                if viewModel.formMarkup > 0 {
                    totalRow("Markup (\(String(format: "%.1f", viewModel.formMarkup))%)",
                             value: totals.subtotal * (viewModel.formMarkup / 100))
                }
                if viewModel.formDiscount > 0 {
                    totalRow("Discount", value: -viewModel.formDiscount, color: AppColors.error)
                }
                if viewModel.formTaxRate > 0 {
                    totalRow("Tax (\(String(format: "%.2f", viewModel.formTaxRate))%)", value: totals.tax)
                }
                Divider()
                HStack {
                    Text("Total")
                        .font(.body)
                        .fontWeight(.bold)
                        .foregroundColor(AppColors.text)
                    Spacer()
                    Text(viewModel.formatCurrency(totals.total))
                        .font(.body)
                        .fontWeight(.bold)
                        .foregroundColor(AppColors.text)
                }
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private func totalRow(_ label: String, value: Double, color: Color = AppColors.textMedium) -> some View {
        HStack {
            Text(label)
                .font(.body)
                .foregroundColor(AppColors.textGray)
            Spacer()
            Text(viewModel.formatCurrency(value))
                .font(.body)
                .fontWeight(.medium)
                .foregroundColor(color)
        }
    }

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Notes", icon: "note.text")

            VStack(alignment: .leading, spacing: 4) {
                Text("Client Notes (visible on invoice)")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textGray)
                TextEditor(text: $viewModel.formClientNotes)
                    .font(.body)
                    .frame(minHeight: 60)
                    .padding(8)
                    .background(AppColors.gray50)
                    .cornerRadius(6)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Admin Notes (internal only)")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textGray)
                TextEditor(text: $viewModel.formAdminNotes)
                    .font(.body)
                    .frame(minHeight: 60)
                    .padding(8)
                    .background(AppColors.warningBg)
                    .cornerRadius(6)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.warningBorder, lineWidth: 1))
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    // MARK: - Invoice Detail View (inline, for activeView == "view")

    private func invoiceDetailView(_ detail: InvoiceDetail) -> some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Back button
                HStack {
                    Button(action: {
                        viewModel.activeView = "list"
                        viewModel.selectedInvoice = nil
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 16))
                            Text("Back to Invoices")
                                .font(.body)
                        }
                        .foregroundColor(AppColors.blue)
                    }
                    Spacer()
                }

                // Invoice header
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(detail.invoiceNumber)
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(AppColors.text)
                            Text(detail.clientDisplayName)
                                .font(.body)
                                .foregroundColor(AppColors.textMedium)
                        }
                        Spacer()
                        invoiceStatusBadgeView(detail.status, label: detail.statusLabel)
                    }

                    HStack(spacing: 16) {
                        if let invoiceDate = detail.invoiceDate {
                            HStack(spacing: 4) {
                                Image(systemName: "calendar").font(.system(size: 14))
                                Text("Date: \(viewModel.formatDate(invoiceDate))")
                                    .font(.body)
                            }
                            .foregroundColor(AppColors.textGray)
                        }
                        if let dueDate = detail.dueDate {
                            HStack(spacing: 4) {
                                Image(systemName: "clock").font(.system(size: 14))
                                Text("Due: \(viewModel.formatDate(dueDate))")
                                    .font(.body)
                            }
                            .foregroundColor(AppColors.textGray)
                        }
                    }
                }
                .padding(16)
                .background(Color.white)
                .cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))

                // Client info
                if let email = detail.email, !email.isEmpty,
                   let phone = detail.phone, !phone.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        sectionHeader("Client", icon: "person")
                        if !email.isEmpty {
                            infoRow("Email", value: email, icon: "envelope")
                        }
                        if !phone.isEmpty {
                            infoRow("Phone", value: phone, icon: "phone")
                        }
                        if let address = detail.address, !address.isEmpty {
                            infoRow("Address", value: address, icon: "mappin")
                        }
                    }
                    .padding(16)
                    .background(Color.white)
                    .cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
                }

                // Line items
                if let items = detail.lineItems, !items.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        sectionHeader("Line Items", icon: "list.bullet")

                        ForEach(items) { item in
                            VStack(spacing: 4) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        if let title = item.title, !title.isEmpty {
                                            Text(title)
                                                .font(.body)
                                                .fontWeight(.medium)
                                                .foregroundColor(AppColors.text)
                                        }
                                        if !item.description.isEmpty {
                                            Text(item.description)
                                                .font(.body)
                                                .foregroundColor(AppColors.textGray)
                                        }
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 2) {
                                        Text(viewModel.formatCurrency(item.totalPrice))
                                            .font(.body)
                                            .fontWeight(.semibold)
                                            .foregroundColor(AppColors.text)
                                        Text("\(String(format: "%.0f", item.quantity)) x \(viewModel.formatCurrency(item.unitPrice))")
                                            .font(.system(size: 14))
                                            .foregroundColor(AppColors.textGray)
                                    }
                                }
                                Divider()
                            }
                        }
                    }
                    .padding(16)
                    .background(Color.white)
                    .cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
                }

                // Totals
                VStack(alignment: .leading, spacing: 8) {
                    sectionHeader("Totals", icon: "dollarsign.circle")

                    VStack(spacing: 6) {
                        totalRow("Subtotal", value: detail.subtotal ?? 0)
                        if let markup = detail.markupAmount, markup > 0 {
                            totalRow("Markup", value: markup)
                        }
                        if let discount = detail.discountAmount, discount > 0 {
                            totalRow("Discount", value: -discount, color: AppColors.error)
                        }
                        if let tax = detail.taxAmount, tax > 0 {
                            let rateStr = detail.taxRate != nil ? " (\(String(format: "%.2f", detail.taxRate!))%)" : ""
                            totalRow("Tax\(rateStr)", value: tax)
                        }
                        Divider()
                        HStack {
                            Text("Total")
                                .font(.body).fontWeight(.bold).foregroundColor(AppColors.text)
                            Spacer()
                            Text(viewModel.formatCurrency(detail.totalAmount))
                                .font(.body).fontWeight(.bold).foregroundColor(AppColors.text)
                        }
                        HStack {
                            Text("Balance Due")
                                .font(.body).fontWeight(.bold).foregroundColor(AppColors.error)
                            Spacer()
                            Text(viewModel.formatCurrency(detail.balanceDue))
                                .font(.body).fontWeight(.bold).foregroundColor(AppColors.error)
                        }
                    }
                }
                .padding(16)
                .background(Color.white)
                .cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))

                // Payments
                paymentsSection(detail)

                // Action buttons
                actionButtonsSection(detail)
            }
            .padding(AppSpacing.lg)
        }
    }

    private func paymentsSection(_ detail: InvoiceDetail) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                sectionHeader("Payments", icon: "creditcard")
                Spacer()
                Button(action: { viewModel.showingPaymentForm = true }) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus").font(.system(size: 14))
                        Text("Add Payment").font(.body)
                    }
                    .foregroundColor(AppColors.blue)
                }
            }

            if let payments = detail.payments, !payments.isEmpty {
                ForEach(payments) { payment in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(payment.formattedAmount)
                                .font(.body)
                                .fontWeight(.semibold)
                                .foregroundColor(AppColors.success)
                            HStack(spacing: 8) {
                                Text(payment.paymentMethodLabel)
                                    .font(.body)
                                    .foregroundColor(AppColors.textMedium)
                                if let date = payment.paymentDate {
                                    Text(viewModel.formatDate(date))
                                        .font(.body)
                                        .foregroundColor(AppColors.textGray)
                                }
                            }
                            if let notes = payment.notes, !notes.isEmpty {
                                Text(notes)
                                    .font(.body)
                                    .foregroundColor(AppColors.textGray)
                            }
                        }
                        Spacer()
                        Button(action: {
                            paymentToDelete = payment
                            showDeletePaymentConfirmation = true
                        }) {
                            Image(systemName: "trash")
                                .font(.system(size: 15))
                                .foregroundColor(AppColors.error)
                                .frame(width: 28, height: 28)
                                .background(AppColors.errorBg)
                                .cornerRadius(4)
                        }
                    }
                    .padding(10)
                    .background(AppColors.successBg)
                    .cornerRadius(6)
                }
            } else {
                Text("No payments recorded")
                    .font(.body)
                    .foregroundColor(AppColors.textGray)
                    .padding(.vertical, 8)
            }

            // Inline payment form
            if viewModel.showingPaymentForm {
                paymentFormSection
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private var paymentFormSection: some View {
        VStack(spacing: 10) {
            Divider()
            Text("Record Payment")
                .font(.body)
                .fontWeight(.semibold)
                .foregroundColor(AppColors.text)

            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Amount").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                    TextField("$0.00", text: $viewModel.paymentAmount)
                        .font(.body)
                        .keyboardType(.decimalPad)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(AppColors.gray50)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Method").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                    Menu {
                        Button("Cash") { viewModel.paymentMethod = "cash" }
                        Button("Check") { viewModel.paymentMethod = "check" }
                        Button("Credit Card") { viewModel.paymentMethod = "credit_card" }
                        Button("Zelle") { viewModel.paymentMethod = "zelle" }
                        Button("Venmo") { viewModel.paymentMethod = "venmo" }
                        Button("Bank Transfer") { viewModel.paymentMethod = "bank_transfer" }
                        Button("Other") { viewModel.paymentMethod = "other" }
                    } label: {
                        HStack {
                            Text(viewModel.paymentMethod.capitalized)
                                .font(.body)
                                .foregroundColor(AppColors.text)
                            Spacer()
                            Image(systemName: "chevron.down")
                                .font(.system(size: 14))
                                .foregroundColor(AppColors.textGray)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(AppColors.gray50)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
                    }
                }
            }

            if viewModel.paymentMethod == "check" {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Check Number").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                    TextField("Check #", text: $viewModel.paymentCheckNumber)
                        .font(.body)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(AppColors.gray50)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Payment Date").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                DatePicker("", selection: $viewModel.paymentDate, displayedComponents: .date)
                    .labelsHidden()
            }

            TextField("Notes (optional)", text: $viewModel.paymentNotes)
                .font(.body)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(AppColors.gray50)
                .cornerRadius(6)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))

            HStack(spacing: 8) {
                Button(action: {
                    Task { await viewModel.addPayment() }
                }) {
                    HStack(spacing: 4) {
                        if viewModel.isSaving {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.7)
                        }
                        Text("Save Payment")
                            .font(.body)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(AppColors.success)
                    .cornerRadius(6)
                }
                .disabled(viewModel.isSaving)

                Button(action: { viewModel.showingPaymentForm = false }) {
                    Text("Cancel")
                        .font(.body)
                        .foregroundColor(AppColors.textGray)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(AppColors.gray200)
                        .cornerRadius(6)
                }
            }
        }
    }

    private func actionButtonsSection(_ detail: InvoiceDetail) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Button(action: { viewModel.prepareEditInvoice(detail) }) {
                    HStack(spacing: 4) {
                        Image(systemName: "pencil").font(.system(size: 15))
                        Text("Edit").font(.body).fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(AppColors.blue)
                    .cornerRadius(6)
                }

                Button(action: { Task { await viewModel.sendEmail() } }) {
                    HStack(spacing: 4) {
                        Image(systemName: "envelope").font(.system(size: 15))
                        Text("Email").font(.body).fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(AppColors.successMedium)
                    .cornerRadius(6)
                }
            }

            HStack(spacing: 8) {
                Button(action: { Task { await viewModel.sendSMS() } }) {
                    HStack(spacing: 4) {
                        Image(systemName: "message").font(.system(size: 15))
                        Text("SMS").font(.body).fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(AppColors.warningMedium)
                    .cornerRadius(6)
                }

                Button(action: {
                    let tempInvoice = Invoice.stub(id: detail.id, invoiceNumber: detail.invoiceNumber)
                    invoiceToDelete = tempInvoice
                    showDeleteInvoiceConfirmation = true
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "trash").font(.system(size: 15))
                        Text("Delete").font(.body).fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(AppColors.error)
                    .cornerRadius(6)
                }
            }
        }
    }

    // MARK: - Shared Helpers

    private func invoiceStatusBadgeView(_ status: String, label: String) -> some View {
        let color: Color = {
            switch status.lowercased() {
            case "draft": return AppColors.gray500
            case "unpaid": return AppColors.error
            case "partial": return AppColors.warningMedium
            case "paid": return AppColors.success
            default: return AppColors.textGray
            }
        }()

        let bgColor: Color = {
            switch status.lowercased() {
            case "draft": return AppColors.gray50
            case "unpaid": return AppColors.errorBg
            case "partial": return AppColors.warningBg
            case "paid": return AppColors.successBg
            default: return AppColors.gray50
            }
        }()

        return Text(label)
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(bgColor)
            .cornerRadius(4)
    }

    private func sectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 16)).foregroundColor(AppColors.blue)
            Text(title).font(.headline).foregroundColor(AppColors.text)
        }
    }

    private func infoRow(_ label: String, value: String, icon: String? = nil) -> some View {
        HStack(spacing: 8) {
            if let icon = icon {
                Image(systemName: icon).font(.system(size: 15))
                    .foregroundColor(AppColors.textGray).frame(width: 16)
            }
            Text(label + ":").font(.body).foregroundColor(AppColors.textGray)
            Text(value).font(.body).foregroundColor(AppColors.text)
            Spacer()
        }
    }

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(AppColors.gray400)
            Text(title)
                .font(.body)
                .foregroundColor(AppColors.textGray)
            Text(subtitle)
                .font(.body)
                .foregroundColor(AppColors.textLight)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .background(AppColors.gray50)
        .cornerRadius(8)
    }

    private func loadingState(_ message: String) -> some View {
        VStack(spacing: 12) {
            ProgressView()
            Text(message)
                .font(.body)
                .foregroundColor(AppColors.textGray)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }

    // MARK: - Notification

    @ViewBuilder
    private var notificationOverlay: some View {
        if let msg = viewModel.successMessage {
            notificationBanner(msg, isError: false)
        } else if let msg = viewModel.errorMessage {
            notificationBanner(msg, isError: true)
        }
    }

    private func notificationBanner(_ message: String, isError: Bool) -> some View {
        Text(message)
            .font(.body)
            .foregroundColor(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(isError ? AppColors.error : AppColors.success)
            .cornerRadius(8)
            .shadow(radius: 8)
            .padding(.top, 8)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                    withAnimation {
                        if isError {
                            viewModel.errorMessage = nil
                        } else {
                            viewModel.successMessage = nil
                        }
                    }
                }
            }
    }
}

// MARK: - Invoice Card

struct InvoiceCard: View {
    let invoice: Invoice
    @ObservedObject var viewModel: InvoiceManagementViewModel
    let onView: () -> Void
    let onDelete: () -> Void

    var body: some View {
        Button(action: onView) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(invoice.invoiceNumber)
                            .font(.headline)
                            .foregroundColor(AppColors.text)
                        Text(invoice.clientDisplayName)
                            .font(.body)
                            .foregroundColor(AppColors.textMedium)
                    }

                    Spacer()

                    invoiceStatusBadge
                }

                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Image(systemName: "dollarsign.circle").font(.system(size: 15))
                            Text(invoice.formattedTotal)
                                .font(.body).fontWeight(.semibold)
                        }
                        .foregroundColor(AppColors.text)

                        if let balance = invoice.balanceDue, balance > 0 {
                            HStack(spacing: 4) {
                                Text("Due:")
                                    .font(.subheadline)
                                    .foregroundColor(AppColors.textGray)
                                Text(invoice.formattedBalance)
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(AppColors.error)
                            }
                        }
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 6) {
                        if let date = invoice.invoiceDate {
                            Text(viewModel.formatDate(date))
                                .font(.subheadline)
                                .foregroundColor(AppColors.textGray)
                        }

                        HStack(spacing: 8) {
                            Button(action: onView) {
                                Image(systemName: "eye").font(.system(size: 15))
                                    .foregroundColor(AppColors.blue)
                                    .frame(width: 32, height: 32)
                                    .background(AppColors.infoBg).cornerRadius(6)
                            }
                            Button(action: onDelete) {
                                Image(systemName: "trash").font(.system(size: 15))
                                    .foregroundColor(AppColors.error)
                                    .frame(width: 32, height: 32)
                                    .background(AppColors.errorBg).cornerRadius(6)
                            }
                        }
                    }
                }
            }
            .padding(16)
            .background(Color.white)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(invoice.status == "unpaid" ? AppColors.errorBorder : AppColors.border, lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }

    private var invoiceStatusBadge: some View {
        let color: Color = {
            switch invoice.status.lowercased() {
            case "draft": return AppColors.gray500
            case "unpaid": return AppColors.error
            case "partial": return AppColors.warningMedium
            case "paid": return AppColors.success
            default: return AppColors.textGray
            }
        }()

        let bgColor: Color = {
            switch invoice.status.lowercased() {
            case "draft": return AppColors.gray50
            case "unpaid": return AppColors.errorBg
            case "partial": return AppColors.warningBg
            case "paid": return AppColors.successBg
            default: return AppColors.gray50
            }
        }()

        return Text(invoice.statusLabel)
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(bgColor)
            .cornerRadius(4)
    }
}

// MARK: - Client Card

struct ClientCard: View {
    let client: Client
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Initials avatar
            Text(client.initials)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.white)
                .frame(width: 40, height: 40)
                .background(AppColors.blue)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(client.displayName)
                    .font(.body)
                    .fontWeight(.semibold)
                    .foregroundColor(AppColors.text)

                HStack(spacing: 8) {
                    if let email = client.email, !email.isEmpty {
                        HStack(spacing: 3) {
                            Image(systemName: "envelope").font(.system(size: 14))
                            Text(email).font(.body).lineLimit(1)
                        }
                        .foregroundColor(AppColors.textGray)
                    }
                    if let phone = client.phone, !phone.isEmpty {
                        HStack(spacing: 3) {
                            Image(systemName: "phone").font(.system(size: 14))
                            Text(phone).font(.body)
                        }
                        .foregroundColor(AppColors.textGray)
                    }
                }
            }

            Spacer()

            HStack(spacing: 4) {
                Button(action: onEdit) {
                    Image(systemName: "pencil").font(.system(size: 16))
                        .foregroundColor(AppColors.blue)
                        .frame(width: 32, height: 32)
                        .background(AppColors.infoBg).cornerRadius(6)
                }
                Button(action: onDelete) {
                    Image(systemName: "trash").font(.system(size: 16))
                        .foregroundColor(AppColors.error)
                        .frame(width: 32, height: 32)
                        .background(AppColors.errorBg).cornerRadius(6)
                }
            }
        }
        .padding(12)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppColors.border, lineWidth: 1)
        )
    }
}

// MARK: - Tax Rate Card

struct TaxRateCard: View {
    let taxRate: TaxRate
    let onDelete: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(taxRate.city)
                        .font(.body)
                        .fontWeight(.semibold)
                        .foregroundColor(AppColors.text)
                    if let stateCode = taxRate.stateCode, !stateCode.isEmpty {
                        Text("- \(stateCode)")
                            .font(.body)
                            .foregroundColor(AppColors.textMedium)
                    }
                }
                if let desc = taxRate.description, !desc.isEmpty {
                    Text(desc)
                        .font(.body)
                        .foregroundColor(AppColors.textGray)
                }
            }

            Spacer()

            Text("\(String(format: "%.2f", taxRate.taxRate))%")
                .font(.body)
                .fontWeight(.bold)
                .foregroundColor(AppColors.blue)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(AppColors.infoBg)
                .cornerRadius(4)

            Button(action: onDelete) {
                Image(systemName: "trash").font(.system(size: 16))
                    .foregroundColor(AppColors.error)
                    .frame(width: 32, height: 32)
                    .background(AppColors.errorBg).cornerRadius(6)
            }
        }
        .padding(12)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppColors.border, lineWidth: 1)
        )
    }
}

// MARK: - Label Card

struct LabelCard: View {
    let label: LineItemLabel
    @ObservedObject var viewModel: InvoiceManagementViewModel
    let onDelete: () -> Void

    var body: some View {
        HStack {
            Image(systemName: "tag")
                .font(.system(size: 16))
                .foregroundColor(AppColors.blue)

            VStack(alignment: .leading, spacing: 2) {
                Text(label.labelName)
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundColor(AppColors.text)
                if let price = label.defaultUnitPrice {
                    Text("Default: \(viewModel.formatCurrency(price))")
                        .font(.body)
                        .foregroundColor(AppColors.textGray)
                }
            }

            Spacer()

            Button(action: onDelete) {
                Image(systemName: "trash").font(.system(size: 16))
                    .foregroundColor(AppColors.error)
                    .frame(width: 32, height: 32)
                    .background(AppColors.errorBg).cornerRadius(6)
            }
        }
        .padding(12)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppColors.border, lineWidth: 1)
        )
    }
}

// MARK: - Invoice Detail Sheet

struct InvoiceDetailSheet: View {
    let detail: InvoiceDetail
    @ObservedObject var viewModel: InvoiceManagementViewModel
    let onDismiss: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void

    @State private var showDeletePaymentConfirmation = false
    @State private var paymentToDelete: InvoicePayment?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.lg) {
                    // Header
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(detail.invoiceNumber)
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(AppColors.text)
                            Spacer()
                            statusBadge
                        }

                        HStack(spacing: 16) {
                            if let invoiceDate = detail.invoiceDate {
                                HStack(spacing: 4) {
                                    Image(systemName: "calendar").font(.system(size: 14))
                                    Text(viewModel.formatDate(invoiceDate)).font(.body)
                                }
                                .foregroundColor(AppColors.textGray)
                            }
                            if let dueDate = detail.dueDate {
                                HStack(spacing: 4) {
                                    Image(systemName: "clock").font(.system(size: 14))
                                    Text("Due: \(viewModel.formatDate(dueDate))").font(.body)
                                }
                                .foregroundColor(AppColors.textGray)
                            }
                        }
                    }
                    .padding(16)
                    .background(Color.white)
                    .cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))

                    // Client info
                    clientSection

                    // Line items
                    if let items = detail.lineItems, !items.isEmpty {
                        lineItemsSection(items)
                    }

                    // Totals
                    totalsSection

                    // Payments
                    paymentsSection

                    // Notes
                    if let notes = detail.clientNotes, !notes.isEmpty {
                        notesCardSection("Client Notes", notes: notes, icon: "note.text")
                    }
                    if let notes = detail.adminNotes, !notes.isEmpty {
                        adminNotesSection(notes)
                    }

                    // Actions
                    actionsSection
                }
                .padding(AppSpacing.lg)
            }
            .background(AppColors.background)
            .navigationTitle("Invoice Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { onDismiss() }
                }
            }
        }
    }

    private var statusBadge: some View {
        let color: Color = {
            switch detail.status.lowercased() {
            case "draft": return AppColors.gray500
            case "unpaid": return AppColors.error
            case "partial": return AppColors.warningMedium
            case "paid": return AppColors.success
            default: return AppColors.textGray
            }
        }()

        let bgColor: Color = {
            switch detail.status.lowercased() {
            case "draft": return AppColors.gray50
            case "unpaid": return AppColors.errorBg
            case "partial": return AppColors.warningBg
            case "paid": return AppColors.successBg
            default: return AppColors.gray50
            }
        }()

        return Text(detail.statusLabel)
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(bgColor)
            .cornerRadius(4)
    }

    private var clientSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sheetSectionHeader("Client Information", icon: "person")

            VStack(alignment: .leading, spacing: 6) {
                infoRow("Name", value: detail.clientDisplayName)
                if let email = detail.email, !email.isEmpty {
                    infoRow("Email", value: email, icon: "envelope")
                }
                if let phone = detail.phone, !phone.isEmpty {
                    infoRow("Phone", value: phone, icon: "phone")
                }
                if let address = detail.address, !address.isEmpty {
                    infoRow("Address", value: address, icon: "mappin")
                }
            }
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private func lineItemsSection(_ items: [InvoiceLineItem]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sheetSectionHeader("Line Items", icon: "list.bullet")

            ForEach(items) { item in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        if let title = item.title, !title.isEmpty {
                            Text(title)
                                .font(.body).fontWeight(.medium)
                                .foregroundColor(AppColors.text)
                        }
                        if !item.description.isEmpty {
                            Text(item.description)
                                .font(.body)
                                .foregroundColor(AppColors.textGray)
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(viewModel.formatCurrency(item.totalPrice))
                            .font(.body).fontWeight(.semibold)
                            .foregroundColor(AppColors.text)
                        Text("\(String(format: "%.0f", item.quantity)) x \(viewModel.formatCurrency(item.unitPrice))")
                            .font(.system(size: 14))
                            .foregroundColor(AppColors.textGray)
                    }
                }
                if item.id != items.last?.id {
                    Divider()
                }
            }
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private var totalsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sheetSectionHeader("Totals", icon: "dollarsign.circle")

            VStack(spacing: 6) {
                sheetTotalRow("Subtotal", value: detail.subtotal ?? 0)
                if let markup = detail.markupAmount, markup > 0 {
                    sheetTotalRow("Markup", value: markup)
                }
                if let discount = detail.discountAmount, discount > 0 {
                    sheetTotalRow("Discount", value: -discount, color: AppColors.error)
                }
                if let tax = detail.taxAmount, tax > 0 {
                    let rateStr = detail.taxRate != nil ? " (\(String(format: "%.2f", detail.taxRate!))%)" : ""
                    sheetTotalRow("Tax\(rateStr)", value: tax)
                }
                Divider()
                HStack {
                    Text("Total").font(.body).fontWeight(.bold).foregroundColor(AppColors.text)
                    Spacer()
                    Text(viewModel.formatCurrency(detail.totalAmount))
                        .font(.body).fontWeight(.bold).foregroundColor(AppColors.text)
                }
                HStack {
                    Text("Balance Due").font(.body).fontWeight(.bold).foregroundColor(AppColors.error)
                    Spacer()
                    Text(viewModel.formatCurrency(detail.balanceDue))
                        .font(.body).fontWeight(.bold).foregroundColor(AppColors.error)
                }
            }
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private var paymentsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                sheetSectionHeader("Payments", icon: "creditcard")
                Spacer()
                Button(action: {
                    viewModel.editingPaymentId = nil
                    viewModel.paymentAmount = ""
                    viewModel.paymentMethod = "cash"
                    viewModel.paymentCheckNumber = ""
                    viewModel.paymentDate = Date()
                    viewModel.paymentNotes = ""
                    viewModel.showingPaymentForm = true
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus").font(.system(size: 14))
                        Text("Add Payment").font(.body)
                    }
                    .foregroundColor(AppColors.blue)
                }
            }

            if let payments = detail.payments, !payments.isEmpty {
                ForEach(payments) { payment in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(payment.formattedAmount)
                                    .font(.body).fontWeight(.semibold)
                                    .foregroundColor(AppColors.success)
                                HStack(spacing: 6) {
                                    Text(payment.paymentMethodLabel).font(.body).foregroundColor(AppColors.textMedium)
                                    if let date = payment.paymentDate {
                                        Text(viewModel.formatDate(date)).font(.body).foregroundColor(AppColors.textGray)
                                    }
                                }
                                if let notes = payment.notes, !notes.isEmpty {
                                    Text(notes)
                                        .font(.body)
                                        .foregroundColor(AppColors.textGray)
                                }
                            }
                            Spacer()
                        }

                        // Action buttons row
                        HStack(spacing: 6) {
                            Button(action: {
                                Task { await viewModel.downloadReceiptPDF(payment) }
                            }) {
                                HStack(spacing: 3) {
                                    Image(systemName: "doc.text").font(.system(size: 12))
                                    Text("Receipt").font(.system(size: 12))
                                }
                                .foregroundColor(AppColors.blue)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(AppColors.infoBg)
                                .cornerRadius(4)
                            }

                            Button(action: {
                                viewModel.prepareSendReceipt(payment)
                            }) {
                                HStack(spacing: 3) {
                                    Image(systemName: "paperplane").font(.system(size: 12))
                                    Text("Send").font(.system(size: 12))
                                }
                                .foregroundColor(AppColors.successMedium)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(AppColors.successBg)
                                .cornerRadius(4)
                            }

                            Button(action: {
                                viewModel.prepareEditPayment(payment)
                            }) {
                                HStack(spacing: 3) {
                                    Image(systemName: "pencil").font(.system(size: 12))
                                    Text("Edit").font(.system(size: 12))
                                }
                                .foregroundColor(AppColors.warningMedium)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(AppColors.warningBg)
                                .cornerRadius(4)
                            }

                            Spacer()

                            Button(action: {
                                paymentToDelete = payment
                                showDeletePaymentConfirmation = true
                            }) {
                                Image(systemName: "trash")
                                    .font(.system(size: 13))
                                    .foregroundColor(AppColors.error)
                                    .frame(width: 26, height: 26)
                                    .background(AppColors.errorBg)
                                    .cornerRadius(4)
                            }
                        }
                    }
                    .padding(10)
                    .background(AppColors.successBg)
                    .cornerRadius(6)
                }
            } else {
                Text("No payments recorded")
                    .font(.body)
                    .foregroundColor(AppColors.textGray)
                    .padding(.vertical, 4)
            }

            // Inline payment form
            if viewModel.showingPaymentForm {
                sheetPaymentForm
            }

            // Send receipt form
            if viewModel.showingSendReceiptForm {
                sendReceiptForm
            }
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
        .alert("Delete Payment", isPresented: $showDeletePaymentConfirmation, presenting: paymentToDelete) { payment in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deletePayment(payment) }
            }
        } message: { _ in
            Text("Are you sure you want to delete this payment?")
        }
    }

    private var sheetPaymentForm: some View {
        VStack(spacing: 10) {
            Divider()
            Text(viewModel.editingPaymentId != nil ? "Edit Payment" : "Record Payment")
                .font(.body)
                .fontWeight(.semibold)
                .foregroundColor(AppColors.text)

            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Amount").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                    TextField("$0.00", text: $viewModel.paymentAmount)
                        .font(.body)
                        .keyboardType(.decimalPad)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(AppColors.gray50)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Method").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                    Menu {
                        Button("Cash") { viewModel.paymentMethod = "cash" }
                        Button("Check") { viewModel.paymentMethod = "check" }
                        Button("Credit Card") { viewModel.paymentMethod = "credit_card" }
                        Button("Zelle") { viewModel.paymentMethod = "zelle" }
                        Button("Venmo") { viewModel.paymentMethod = "venmo" }
                        Button("Bank Transfer") { viewModel.paymentMethod = "bank_transfer" }
                        Button("Other") { viewModel.paymentMethod = "other" }
                    } label: {
                        HStack {
                            Text(viewModel.paymentMethod.capitalized)
                                .font(.body)
                                .foregroundColor(AppColors.text)
                            Spacer()
                            Image(systemName: "chevron.down")
                                .font(.system(size: 14))
                                .foregroundColor(AppColors.textGray)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(AppColors.gray50)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
                    }
                }
            }

            if viewModel.paymentMethod == "check" {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Check Number").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                    TextField("Check #", text: $viewModel.paymentCheckNumber)
                        .font(.body)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(AppColors.gray50)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Payment Date").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                DatePicker("", selection: $viewModel.paymentDate, displayedComponents: .date)
                    .labelsHidden()
            }

            TextField("Notes (optional)", text: $viewModel.paymentNotes)
                .font(.body)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(AppColors.gray50)
                .cornerRadius(6)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))

            HStack(spacing: 8) {
                Button(action: {
                    Task { await viewModel.addPayment() }
                }) {
                    HStack(spacing: 4) {
                        if viewModel.isSaving {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.7)
                        }
                        Text(viewModel.editingPaymentId != nil ? "Update Payment" : "Save Payment")
                            .font(.body)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(AppColors.success)
                    .cornerRadius(6)
                }
                .disabled(viewModel.isSaving)

                Button(action: {
                    viewModel.editingPaymentId = nil
                    viewModel.showingPaymentForm = false
                }) {
                    Text("Cancel")
                        .font(.body)
                        .foregroundColor(AppColors.textGray)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(AppColors.gray200)
                        .cornerRadius(6)
                }
            }
        }
    }

    // MARK: - Send Receipt Form

    private var sendReceiptForm: some View {
        VStack(spacing: 10) {
            Divider()
            Text("Send Receipt")
                .font(.body)
                .fontWeight(.semibold)
                .foregroundColor(AppColors.text)

            if let payment = viewModel.sendReceiptPayment {
                Text("Payment: \(payment.formattedAmount) - \(payment.paymentMethodLabel)")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textMedium)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Send Via").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                HStack(spacing: 8) {
                    sendViaButton("Email", value: "email", icon: "envelope")
                    sendViaButton("SMS", value: "sms", icon: "message")
                    sendViaButton("Both", value: "both", icon: "paperplane")
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(viewModel.sendReceiptVia == "sms" ? "Phone Number" : "Recipient")
                    .font(.system(size: 14)).foregroundColor(AppColors.textGray)
                TextField(
                    viewModel.sendReceiptVia == "sms" ? "Phone number" : "Email address",
                    text: $viewModel.sendReceiptRecipient
                )
                .font(.body)
                .keyboardType(viewModel.sendReceiptVia == "sms" ? .phonePad : .emailAddress)
                .autocapitalization(.none)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(AppColors.gray50)
                .cornerRadius(6)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Language").font(.system(size: 14)).foregroundColor(AppColors.textGray)
                HStack(spacing: 8) {
                    languageButton("English", value: "en")
                    languageButton("Spanish", value: "es")
                }
            }

            HStack(spacing: 8) {
                Button(action: {
                    Task { await viewModel.sendReceipt() }
                }) {
                    HStack(spacing: 4) {
                        if viewModel.isSaving {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.7)
                        }
                        Text("Send Receipt")
                            .font(.body)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(AppColors.successMedium)
                    .cornerRadius(6)
                }
                .disabled(viewModel.isSaving)

                Button(action: {
                    viewModel.showingSendReceiptForm = false
                    viewModel.sendReceiptPayment = nil
                }) {
                    Text("Cancel")
                        .font(.body)
                        .foregroundColor(AppColors.textGray)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(AppColors.gray200)
                        .cornerRadius(6)
                }
            }
        }
    }

    private func sendViaButton(_ label: String, value: String, icon: String) -> some View {
        Button(action: {
            viewModel.sendReceiptVia = value
            // Update recipient based on send method
            if value == "sms" {
                if let phone = detail.phone, !phone.isEmpty {
                    viewModel.sendReceiptRecipient = phone
                } else {
                    viewModel.sendReceiptRecipient = ""
                }
            } else {
                if let email = detail.email, !email.isEmpty {
                    viewModel.sendReceiptRecipient = email
                } else {
                    viewModel.sendReceiptRecipient = ""
                }
            }
        }) {
            HStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 12))
                Text(label).font(.system(size: 13, weight: .medium))
            }
            .foregroundColor(viewModel.sendReceiptVia == value ? .white : AppColors.textMedium)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(viewModel.sendReceiptVia == value ? AppColors.blue : AppColors.gray50)
            .cornerRadius(6)
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(
                viewModel.sendReceiptVia == value ? AppColors.blue : AppColors.border, lineWidth: 1
            ))
        }
    }

    private func languageButton(_ label: String, value: String) -> some View {
        Button(action: { viewModel.sendReceiptLanguage = value }) {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(viewModel.sendReceiptLanguage == value ? .white : AppColors.textMedium)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(viewModel.sendReceiptLanguage == value ? AppColors.blue : AppColors.gray50)
                .cornerRadius(6)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(
                    viewModel.sendReceiptLanguage == value ? AppColors.blue : AppColors.border, lineWidth: 1
                ))
        }
    }

    private func notesCardSection(_ title: String, notes: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sheetSectionHeader(title, icon: icon)
            Text(notes).font(.body).foregroundColor(AppColors.textMedium)
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private func adminNotesSection(_ notes: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sheetSectionHeader("Admin Notes", icon: "note.text")
            Text(notes).font(.body).foregroundColor(AppColors.textMedium)
        }
        .padding(16).background(AppColors.warningBg).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.warningBorder, lineWidth: 1))
    }

    private var actionsSection: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Button(action: onEdit) {
                    HStack(spacing: 4) {
                        Image(systemName: "pencil").font(.system(size: 15))
                        Text("Edit").font(.body).fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(AppColors.blue)
                    .cornerRadius(6)
                }

                Button(action: { Task { await viewModel.sendEmail() } }) {
                    HStack(spacing: 4) {
                        Image(systemName: "envelope").font(.system(size: 15))
                        Text("Send Email").font(.body).fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(AppColors.successMedium)
                    .cornerRadius(6)
                }
            }

            HStack(spacing: 8) {
                Button(action: { Task { await viewModel.sendSMS() } }) {
                    HStack(spacing: 4) {
                        Image(systemName: "message").font(.system(size: 15))
                        Text("Send SMS").font(.body).fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(AppColors.warningMedium)
                    .cornerRadius(6)
                }

                Button(action: onDelete) {
                    HStack(spacing: 4) {
                        Image(systemName: "trash").font(.system(size: 15))
                        Text("Delete").font(.body).fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(AppColors.error)
                    .cornerRadius(6)
                }
            }
        }
    }

    // Sheet-local helpers

    private func sheetSectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 16)).foregroundColor(AppColors.blue)
            Text(title).font(.headline).foregroundColor(AppColors.text)
        }
    }

    private func infoRow(_ label: String, value: String, icon: String? = nil) -> some View {
        HStack(spacing: 8) {
            if let icon = icon {
                Image(systemName: icon).font(.system(size: 15))
                    .foregroundColor(AppColors.textGray).frame(width: 16)
            }
            Text(label + ":").font(.body).foregroundColor(AppColors.textGray)
            Text(value).font(.body).foregroundColor(AppColors.text)
            Spacer()
        }
    }

    private func sheetTotalRow(_ label: String, value: Double, color: Color = AppColors.textMedium) -> some View {
        HStack {
            Text(label).font(.body).foregroundColor(AppColors.textGray)
            Spacer()
            Text(viewModel.formatCurrency(value))
                .font(.body).fontWeight(.medium).foregroundColor(color)
        }
    }
}

// MARK: - Client Form Sheet

struct ClientFormSheet: View {
    @ObservedObject var viewModel: InvoiceManagementViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.md) {
                    Toggle("Business Client", isOn: $viewModel.clientIsBusiness)
                        .font(.body)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color.white)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))

                    if viewModel.clientIsBusiness {
                        formField("Company Name", text: $viewModel.clientCompanyName)
                    }

                    formField("First Name", text: $viewModel.clientFirstName)
                    formField("Last Name", text: $viewModel.clientLastName)
                    formField("Email", text: $viewModel.clientEmail, keyboard: .emailAddress)
                    formField("Phone", text: $viewModel.clientPhone, keyboard: .phonePad)
                    formField("Address", text: $viewModel.clientAddress)

                    Button(action: {
                        Task { await viewModel.saveClient() }
                    }) {
                        HStack(spacing: 8) {
                            if viewModel.isSaving {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            }
                            Text(viewModel.editingClientId != nil ? "Update Client" : "Create Client")
                                .font(.body).fontWeight(.semibold)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(AppColors.blue)
                        .cornerRadius(8)
                    }
                    .disabled(viewModel.isSaving)
                }
                .padding(AppSpacing.lg)
            }
            .background(AppColors.background)
            .navigationTitle(viewModel.editingClientId != nil ? "Edit Client" : "New Client")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { viewModel.showingClientForm = false }
                }
            }
        }
    }

    private func formField(_ placeholder: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        TextField(placeholder, text: text)
            .font(.body)
            .keyboardType(keyboard)
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .background(Color.white)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(AppColors.border, lineWidth: 1)
            )
    }
}

// MARK: - Tax Rate Form Sheet

struct TaxRateFormSheet: View {
    @Binding var stateCode: String
    @Binding var city: String
    @Binding var rate: String
    @Binding var description: String
    let isSaving: Bool
    let onSave: () -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.md) {
                    formField("City", text: $city)
                    formField("State Code (optional, e.g. TX)", text: $stateCode)
                    formField("Tax Rate %", text: $rate, keyboard: .decimalPad)
                    formField("Description (optional)", text: $description)

                    Button(action: onSave) {
                        HStack(spacing: 8) {
                            if isSaving {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            }
                            Text("Create Tax Rate")
                                .font(.body).fontWeight(.semibold)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(AppColors.blue)
                        .cornerRadius(8)
                    }
                    .disabled(isSaving)
                }
                .padding(AppSpacing.lg)
            }
            .background(AppColors.background)
            .navigationTitle("New Tax Rate")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { onCancel() }
                }
            }
        }
    }

    private func formField(_ placeholder: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        TextField(placeholder, text: text)
            .font(.body)
            .keyboardType(keyboard)
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .background(Color.white)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(AppColors.border, lineWidth: 1)
            )
    }
}

// MARK: - Label Form Sheet

struct LabelFormSheet: View {
    @Binding var name: String
    @Binding var defaultPrice: String
    let isSaving: Bool
    let onSave: () -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.md) {
                    formField("Label Name", text: $name)
                    formField("Default Unit Price (optional)", text: $defaultPrice, keyboard: .decimalPad)

                    Button(action: onSave) {
                        HStack(spacing: 8) {
                            if isSaving {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            }
                            Text("Create Label")
                                .font(.body).fontWeight(.semibold)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(AppColors.blue)
                        .cornerRadius(8)
                    }
                    .disabled(isSaving)
                }
                .padding(AppSpacing.lg)
            }
            .background(AppColors.background)
            .navigationTitle("New Label")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { onCancel() }
                }
            }
        }
    }

    private func formField(_ placeholder: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        TextField(placeholder, text: text)
            .font(.body)
            .keyboardType(keyboard)
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .background(Color.white)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(AppColors.border, lineWidth: 1)
            )
    }
}

// MARK: - Invoice Stub Helper

extension Invoice {
    /// Creates a minimal Invoice stub for deletion purposes
    static func stub(id: Int, invoiceNumber: String) -> Invoice {
        // We need to create via decoding since there's a custom init(from:)
        let json: [String: Any] = [
            "id": id,
            "invoiceNumber": invoiceNumber,
            "status": "draft"
        ]
        let data = try! JSONSerialization.data(withJSONObject: json)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try! decoder.decode(Invoice.self, from: data)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        InvoiceManagementView()
    }
}
