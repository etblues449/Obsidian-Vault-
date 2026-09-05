pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "jarvis"

include(
    ":app",
    ":core:data",
    ":core:network",
    ":core:model",
    ":core:database",
    ":core:ui",
    ":core:designsystem",
    ":core:common",
    ":feature:capture:api",
    ":feature:capture:impl",
    ":feature:ask:api",
    ":feature:ask:impl",
    ":feature:digest:api",
    ":feature:digest:impl",
    ":feature:ha-control:api",
    ":feature:ha-control:impl",
    ":feature:settings:api",
    ":feature:settings:impl",
)
