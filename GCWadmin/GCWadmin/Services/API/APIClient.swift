//
//  APIClient.swift
//  GCWadmin
//
//  Networking layer using async/await and URLSession
//  Base URL: https://api.gudinocustom.com
//

import Foundation

// MARK: - API Configuration
enum APIEnvironment {
    case development
    case staging
    case production

    var baseURL: String {
        switch self {
        case .development:
            return "http://192.168.10.18:3001"
        case .staging:
            return "https://staging-api.gudinocustom.com"
        case .production:
            return "https://api.gudinocustom.com"
        }
    }
}

enum APIConfig {
    // CHANGE THIS to switch between environments
    static let environment: APIEnvironment = .development

    static var baseURL: String {
        environment.baseURL
    }

    static let timeout: TimeInterval = 30
}

// MARK: - API Error
enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case serverError(String)
    case decodingError(Error)
    case networkError(Error)
    case unknown

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Unauthorized - please log in again"
        case .forbidden:
            return "Access forbidden"
        case .notFound:
            return "Resource not found"
        case .serverError(let message):
            return message
        case .decodingError(let error):
            return "Data parsing error: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .unknown:
            return "An unexpected error occurred"
        }
    }
}

// MARK: - API Response
struct APIResponse<T: Decodable>: Decodable {
    let success: Bool?
    let data: T?
    let message: String?
    let error: String?
}

// MARK: - API Client
class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = APIConfig.timeout
        config.timeoutIntervalForResource = APIConfig.timeout * 2

        session = URLSession(configuration: config)

        decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        encoder = JSONEncoder()
        // Don't convert keys - backend expects camelCase
        encoder.keyEncodingStrategy = .useDefaultKeys
    }

    // MARK: - GET Request
    func get<T: Decodable>(_ endpoint: String, queryItems: [URLQueryItem]? = nil) async throws -> T {
        let request = try buildRequest(endpoint: endpoint, method: "GET", queryItems: queryItems)
        return try await execute(request)
    }

    // MARK: - POST Request
    func post<T: Decodable>(_ endpoint: String, body: [String: Any]? = nil) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, method: "POST")
        if let body = body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        return try await execute(request)
    }

    // MARK: - POST Request (Encodable body)
    func post<T: Decodable, B: Encodable>(_ endpoint: String, body: B) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, method: "POST")
        request.httpBody = try encoder.encode(body)
        return try await execute(request)
    }
    
    // MARK: - POST Request (no body)
    func post<T: Decodable>(_ endpoint: String) async throws -> T {
        let request = try buildRequest(endpoint: endpoint, method: "POST")
        return try await execute(request)
    }

    // MARK: - PUT Request
    func put<T: Decodable>(_ endpoint: String, body: [String: Any]? = nil) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, method: "PUT")
        if let body = body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        return try await execute(request)
    }
    
    // MARK: - PUT Request (Encodable body)
    func put<T: Decodable, B: Encodable>(_ endpoint: String, body: B) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, method: "PUT")
        request.httpBody = try encoder.encode(body)
        return try await execute(request)
    }

    // MARK: - PATCH Request
    func patch<T: Decodable>(_ endpoint: String, body: [String: Any]? = nil) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, method: "PATCH")
        if let body = body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        return try await execute(request)
    }

    // MARK: - PATCH Request (Encodable body)
    func patch<T: Decodable, B: Encodable>(_ endpoint: String, body: B) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, method: "PATCH")
        request.httpBody = try encoder.encode(body)
        return try await execute(request)
    }

    // MARK: - DELETE Request
    func delete<T: Decodable>(_ endpoint: String) async throws -> T {
        let request = try buildRequest(endpoint: endpoint, method: "DELETE")
        return try await execute(request)
    }

    // MARK: - Private Helpers

    private func buildRequest(
        endpoint: String,
        method: String,
        queryItems: [URLQueryItem]? = nil
    ) throws -> URLRequest {
        guard var urlComponents = URLComponents(string: APIConfig.baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        if let queryItems = queryItems {
            urlComponents.queryItems = queryItems
        }

        guard let url = urlComponents.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Add auth token if available
        if let token = try? KeychainService.shared.get(for: AuthManager.accessTokenKey) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        do {
            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            // Debug logging
            #if DEBUG
            print("API \(request.httpMethod ?? "?") \(request.url?.path ?? ""): \(httpResponse.statusCode)")
            if let bodyString = String(data: data, encoding: .utf8), bodyString.count < 500 {
                print("Response: \(bodyString)")
            }
            #endif

            // Handle status codes
            switch httpResponse.statusCode {
            case 200...299:
                break // Success
            case 401:
                throw APIError.unauthorized
            case 403:
                throw APIError.forbidden
            case 404:
                throw APIError.notFound
            case 500...599:
                if let errorResponse = try? decoder.decode(APIResponse<String>.self, from: data) {
                    throw APIError.serverError(errorResponse.message ?? errorResponse.error ?? "Server error")
                }
                throw APIError.serverError("Internal server error")
            default:
                throw APIError.unknown
            }

            // Decode response
            do {
                // Try direct decoding first
                return try decoder.decode(T.self, from: data)
            } catch {
                // Try wrapped response
                if let wrapped = try? decoder.decode(APIResponse<T>.self, from: data),
                   let responseData = wrapped.data {
                    return responseData
                }
                throw APIError.decodingError(error)
            }

        } catch let error as APIError {
            throw error
        } catch let error as URLError {
            throw APIError.networkError(error)
        } catch let error as DecodingError {
            throw APIError.decodingError(error)
        } catch {
            throw APIError.networkError(error)
        }
    }
}
