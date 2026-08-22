import Foundation

enum HTTPMethod: String { case GET, POST, PATCH, DELETE }

struct APIError: LocalizedError {
    let statusCode: Int
    let message: String
    var needCoins: Int?
    var errorDescription: String? { message }
}

private struct ErrorEnvelope: Decodable {
    let error: String?
    let needCoins: Int?
    enum CodingKeys: String, CodingKey { case error; case needCoins = "need_coins" }
}

final class APIClient: @unchecked Sendable {
    static let shared = APIClient()
    static var baseURL: URL {
#if DEBUG
        if let value = ProcessInfo.processInfo.environment["THEONE_API_BASE_URL"],
           let url = URL(string: value), !value.isEmpty {
            return url
        }
#if targetEnvironment(simulator)
        // simctl 直接启动不会读取 Xcode Scheme 中的环境变量。
        // 调试模拟器默认连接本机 Web/API，避免误连线上地址后长时间停在启动页。
        return URL(string: "http://127.0.0.1:3000")!
#endif
#endif
        return URL(string: "https://www.the-one-and-the-two.com")!
    }

    private let session: URLSession
    private let decoder: JSONDecoder

    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 40
        configuration.timeoutIntervalForResource = 150
        configuration.httpCookieAcceptPolicy = .always
        configuration.httpCookieStorage = .shared
        configuration.httpAdditionalHeaders = [
            "Accept": "application/json",
            "X-TheOne-Client": "ios-native/1.0"
        ]
        session = URLSession(configuration: configuration)
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
    }

    @MainActor
    func request<T: Decodable>(
        _ path: String,
        method: HTTPMethod = .GET,
        json: Any? = nil,
        query: [URLQueryItem] = []
    ) async throws -> T {
        let request = try makeRequest(path, method: method, json: json, query: query)
        let (data, response) = try await perform(request)
        try validate(response, data: data)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError(statusCode: 0, message: "服务器返回的数据格式异常，请稍后重试")
        }
    }

    @MainActor
    func request(
        _ path: String,
        method: HTTPMethod = .GET,
        json: Any? = nil,
        query: [URLQueryItem] = []
    ) async throws {
        let request = try makeRequest(path, method: method, json: json, query: query)
        let (data, response) = try await perform(request)
        try validate(response, data: data)
    }

    private func perform(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch let error as URLError {
            throw APIError(statusCode: 0, message: Self.describe(error))
        }
    }

    private static func describe(_ error: URLError) -> String {
        let host = baseURL.host() ?? "服务器"
        switch error.code {
        case .notConnectedToInternet, .networkConnectionLost:
            return "设备当前没有可用的网络连接"
        case .timedOut:
            return "连接 \(host) 超时，请检查网络后重试"
        case .cannotFindHost, .dnsLookupFailed:
            return "找不到服务器 \(host)，请检查网络或域名解析"
        case .cannotConnectToHost:
            return "无法连接服务器 \(host)（服务可能未启动或端口不通）"
        case .appTransportSecurityRequiresSecureConnection:
            return "系统安全策略（ATS）拒绝了非 HTTPS 连接"
        case .secureConnectionFailed, .serverCertificateUntrusted:
            return "与 \(host) 的安全连接失败（证书问题）"
        default:
            return "网络错误（\(error.code.rawValue)）：\(error.localizedDescription)"
        }
    }

    @MainActor
    func streamText(
        _ path: String,
        json: Any,
        onText: @escaping @MainActor (String) -> Void
    ) async throws {
        let request = try makeRequest(path, method: .POST, json: json)
        let bytes: URLSession.AsyncBytes
        let response: URLResponse
        do {
            (bytes, response) = try await session.bytes(for: request)
        } catch let error as URLError {
            throw APIError(statusCode: 0, message: Self.describe(error))
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError(statusCode: 0, message: "服务器响应无效")
        }
        guard (200..<300).contains(http.statusCode) else {
            var data = Data()
            for try await byte in bytes { data.append(byte) }
            try validate(http, data: data)
            return
        }
        // 网页端 /api/chat 是纯文本字节流（非 SSE、非按行）。
        // 按字节缓冲并在 UTF-8 字符边界处增量解码，保持与浏览器 TextDecoder(stream: true) 一致的出字节奏。
        var buffer = Data()
        for try await byte in bytes {
            buffer.append(byte)
            if buffer.count >= 64, let decoded = Self.decodeCompleteUTF8Prefix(&buffer), !decoded.isEmpty {
                onText(decoded)
            }
        }
        if !buffer.isEmpty {
            onText(String(decoding: buffer, as: UTF8.self))
        }
    }

    /// 从缓冲区取出可完整解码的 UTF-8 前缀，末尾不完整的多字节序列留在缓冲区。
    private static func decodeCompleteUTF8Prefix(_ buffer: inout Data) -> String? {
        var end = buffer.count
        var index = buffer.count - 1
        var trailing = 0
        while index >= 0, trailing < 4 {
            let byte = buffer[buffer.startIndex + index]
            if byte & 0b1100_0000 == 0b1000_0000 {
                trailing += 1
                index -= 1
                continue
            }
            let expected: Int
            if byte & 0b1000_0000 == 0 { expected = 1 }
            else if byte & 0b1110_0000 == 0b1100_0000 { expected = 2 }
            else if byte & 0b1111_0000 == 0b1110_0000 { expected = 3 }
            else if byte & 0b1111_1000 == 0b1111_0000 { expected = 4 }
            else { expected = 1 }
            if trailing + 1 < expected { end = index }
            break
        }
        guard end > 0 else { return nil }
        let prefix = buffer.prefix(end)
        buffer.removeFirst(end)
        return String(decoding: prefix, as: UTF8.self)
    }

    private func makeRequest(
        _ path: String,
        method: HTTPMethod,
        json: Any?,
        query: [URLQueryItem] = []
    ) throws -> URLRequest {
        guard var components = URLComponents(url: Self.baseURL.appending(path: path), resolvingAgainstBaseURL: false) else {
            throw APIError(statusCode: 0, message: "请求地址无效")
        }
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw APIError(statusCode: 0, message: "请求地址无效") }
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        if let json { request.httpBody = try JSONSerialization.data(withJSONObject: json) }
        return request
    }

    private func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError(statusCode: 0, message: "服务器响应无效")
        }
        guard (200..<300).contains(http.statusCode) else {
            if let envelope = try? decoder.decode(ErrorEnvelope.self, from: data),
               let message = envelope.error, !message.isEmpty {
                throw APIError(statusCode: http.statusCode, message: message, needCoins: envelope.needCoins)
            }
            throw APIError(statusCode: http.statusCode, message: Self.fallbackMessage(for: http.statusCode))
        }
    }

    private static func fallbackMessage(for statusCode: Int) -> String {
        switch statusCode {
        case 401:
            return "登录状态已失效，请重新登录（401）"
        case 403:
            return "没有权限执行此操作（403）"
        case 404:
            return "接口不存在（404）：服务器可能尚未部署此功能的最新版本"
        case 429:
            return "请求过于频繁，请稍后再试（429）"
        case 500...599:
            return "服务器内部错误（\(statusCode)），请稍后重试"
        default:
            return "请求失败（HTTP \(statusCode)），请稍后重试"
        }
    }
}
