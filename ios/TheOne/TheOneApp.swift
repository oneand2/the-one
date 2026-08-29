import SwiftUI
import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, shouldRestoreSecureApplicationState coder: NSCoder) -> Bool {
        false
    }

    func application(_ application: UIApplication, shouldSaveSecureApplicationState coder: NSCoder) -> Bool {
        false
    }
}

@main
struct TheOneApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
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
                    if auth.isAuthenticated {
                        await profile.load()
                        await purchases.recoverUnfinishedTransactions()
                    }
                    await purchases.prepare()
                }
                .onChange(of: auth.isAuthenticated) { _, authenticated in
                    if authenticated {
                        Task {
                            await profile.load()
                            await purchases.recoverUnfinishedTransactions()
                        }
                    } else {
                        profile.reset()
                    }
                }
        }
    }
}
