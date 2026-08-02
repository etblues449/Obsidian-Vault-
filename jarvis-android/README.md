# JARVIS Android

Native Android client for JARVIS on Samsung Galaxy Z Fold 7, built with Kotlin, Jetpack Compose, and modern Android architecture patterns.

## Architecture

Multi-module architecture following Google's NowInAndroid patterns:

```
app/                          # Launcher, navigation scaffolding
├── MainActivity.kt
├── JarvisApp.kt
└── navigation/

core/                         # Shared infrastructure
├── data/                      # Repositories, data sources
├── network/                   # JARVIS API client, HTTP config
├── model/                     # Domain models (pure Kotlin)
├── database/                  # Room DAOs and entities
├── ui/                        # Reusable Compose components
├── designsystem/              # Theme, colors, typography
└── common/                    # Utilities, extensions

feature/                      # Feature modules (api + impl split)
├── capture/                   # Text/voice input → Inbox
│   ├── api/                   # Navigation contracts
│   └── impl/                  # Screen, ViewModel, DI
├── ask/                       # Q&A grounded in recent captures
│   ├── api/
│   └── impl/
├── digest/                    # Daily summary view
│   ├── api/
│   └── impl/
├── ha-control/                # Home Assistant device control
│   ├── api/
│   └── impl/
└── settings/                  # App preferences, API config
    ├── api/
    └── impl/
```

## Gradle Structure

- **settings.gradle.kts** — Project configuration, module includes
- **build.gradle.kts** — Root build plugins (no dependencies)
- **gradle/libs.versions.toml** — Version catalog (single source of truth)
- Each module has its own `build.gradle.kts` with specific dependencies

## Key Dependencies

| Category | Libraries |
|----------|-----------|
| **UI** | Jetpack Compose (Material3), Compose Navigation |
| **Architecture** | MVVM, Hilt DI, Flow, StateFlow |
| **Network** | Retrofit, OkHttp, Kotlinx Serialization |
| **Data** | Room, Preferences DataStore |
| **Async** | Kotlin Coroutines |
| **Testing** | JUnit, Compose UI Test, Turbine |

## Building

```bash
cd jarvis-android
./gradlew assembleDebug      # Build debug APK
./gradlew installDebug       # Install on device
```

## Patterns

### ViewModel + UiState

```kotlin
@HiltViewModel
class CaptureViewModel @Inject constructor(
    private val repository: CaptureRepository,
) : ViewModel() {
    val uiState: StateFlow<CaptureUiState> = repository
        .captureFlow()
        .map { CaptureUiState.Success(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), CaptureUiState.Loading)
}
```

### Screen + Navigation

```kotlin
@Composable
internal fun CaptureRoute(
    onNavigateToAsk: () -> Unit,
    viewModel: CaptureViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    CaptureScreen(uiState = uiState, onNavigateToAsk = onNavigateToAsk)
}
```

### Repository Pattern

```kotlin
interface CaptureRepository {
    fun captureFlow(): Flow<List<Capture>>
    suspend fun addCapture(text: String)
}

internal class OfflineFirstCaptureRepository @Inject constructor(
    private val local: CaptureDao,
    private val remote: JarvisApi,
) : CaptureRepository {
    override fun captureFlow() = local.getAll()
    override suspend fun addCapture(text: String) {
        local.insert(Capture(text = text, timestamp = Clock.System.now()))
    }
}
```

## API Integration

JARVIS Android communicates with:

1. **JARVIS Vault API** — GitHub REST API to read/write vault
2. **Home Assistant REST** — HA light/device control
3. **Groq API** — LLM inference (future: on-device via NNAPI)
4. **Web Speech API** — STT/TTS (via WebSocket or local bridge)

## Next Steps

- [ ] Implement `core/network` with Retrofit + okhttp interceptors
- [ ] Create `CaptureRepository` + Room schema
- [ ] Build `capture:impl` feature with voice input
- [ ] Build `ask:impl` with API-grounded Q&A
- [ ] Integrate HA REST for device control
- [ ] Add preference DataStore for API key storage

## References

- [Android Architecture Guidance](https://developer.android.com/topic/architecture)
- [Jetpack Compose Patterns](https://developer.android.com/jetpack/compose)
- [Room Database](https://developer.android.com/training/data-storage/room)
- [Hilt Dependency Injection](https://developer.android.com/training/dependency-injection/hilt-android)
