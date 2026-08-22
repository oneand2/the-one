import SwiftUI

@main
struct TheOneApp: App {
    @StateObject private var auth = AuthStore()
    @StateObject private var profile = ProfileStore()
    @StateObject private var purchases = StoreKitManager()
    @StateObject private var flow = AppFlowStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(profile)
                .environmentObject(purchases)
                .environmentObject(flow)
                .preferredColorScheme(.light)
                .task {
                    await auth.restoreSession()
                    if auth.isAuthenticated { await profile.load() }
                    await purchases.prepare()
                }
                .onChange(of: auth.isAuthenticated) { _, authenticated in
                    if authenticated {
                        Task { await profile.load() }
                    } else {
                        profile.reset()
                    }
                }
        }
    }
}
