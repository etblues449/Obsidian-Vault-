#include "es7210.h"
#include "esphome/core/log.h"

namespace esphome {
namespace es7210 {

static const char *const TAG = "es7210";

bool ES7210::write_reg_(uint8_t reg, uint8_t value) {
  if (this->write_byte(reg, value)) {
    return true;
  }
  ESP_LOGE(TAG, "Write failed: reg 0x%02X = 0x%02X", reg, value);
  return false;
}

bool ES7210::read_reg_(uint8_t reg, uint8_t *value) {
  if (this->read_byte(reg, value)) {
    return true;
  }
  ESP_LOGE(TAG, "Read failed: reg 0x%02X", reg);
  return false;
}

bool ES7210::update_reg_bits_(uint8_t reg, uint8_t mask, uint8_t value) {
  uint8_t current;
  if (!this->read_reg_(reg, &current)) {
    return false;
  }
  current &= ~mask;
  current |= (value & mask);
  return this->write_reg_(reg, current);
}

// Mirrors get_db() in Espressif's es7210.c: 3 dB steps to 33 dB, then the
// discrete high-gain codes 30 / 34.5 / 36 / 37.5 dB.
uint8_t ES7210::gain_to_reg_(float db) {
  db += 0.5f;
  if (db < 33.0f) {
    return db < 3.0f ? 0 : static_cast<uint8_t>(db / 3.0f);
  }
  if (db < 34.5f) {
    return 0x0B;
  }
  if (db < 36.0f) {
    return 0x0C;
  }
  if (db < 37.0f) {
    return 0x0D;
  }
  return 0x0E;
}

bool ES7210::apply_gain_() {
  const uint8_t gain = ES7210::gain_to_reg_(this->mic_gain_);
  bool ok = true;
  if (this->mic_1_)
    ok &= this->update_reg_bits_(ES7210_MIC1_GAIN_REG43, 0x0F, gain);
  if (this->mic_2_)
    ok &= this->update_reg_bits_(ES7210_MIC2_GAIN_REG44, 0x0F, gain);
  if (this->mic_3_)
    ok &= this->update_reg_bits_(ES7210_MIC3_GAIN_REG45, 0x0F, gain);
  if (this->mic_4_)
    ok &= this->update_reg_bits_(ES7210_MIC4_GAIN_REG46, 0x0F, gain);
  return ok;
}

bool ES7210::configure_mic_channels_() {
  bool ok = true;

  // Clear the per-channel enable bit on all four PGAs first.
  for (uint8_t i = 0; i < 4; i++) {
    ok &= this->update_reg_bits_(ES7210_MIC1_GAIN_REG43 + i, 0x10, 0x00);
  }
  // Power down all mic blocks, then selectively re-enable.
  ok &= this->write_reg_(ES7210_MIC12_POWER_REG4B, 0xFF);
  ok &= this->write_reg_(ES7210_MIC34_POWER_REG4C, 0xFF);

  if (this->mic_1_ || this->mic_2_) {
    ok &= this->update_reg_bits_(ES7210_CLOCK_OFF_REG01, 0x0B, 0x00);
    ok &= this->write_reg_(ES7210_MIC12_POWER_REG4B, 0x00);
    if (this->mic_1_)
      ok &= this->update_reg_bits_(ES7210_MIC1_GAIN_REG43, 0x10, 0x10);
    if (this->mic_2_)
      ok &= this->update_reg_bits_(ES7210_MIC2_GAIN_REG44, 0x10, 0x10);
  }
  if (this->mic_3_ || this->mic_4_) {
    ok &= this->update_reg_bits_(ES7210_CLOCK_OFF_REG01, 0x15, 0x00);
    ok &= this->write_reg_(ES7210_MIC34_POWER_REG4C, 0x00);
    if (this->mic_3_)
      ok &= this->update_reg_bits_(ES7210_MIC3_GAIN_REG45, 0x10, 0x10);
    if (this->mic_4_)
      ok &= this->update_reg_bits_(ES7210_MIC4_GAIN_REG46, 0x10, 0x10);
  }

  // TDM is only required when all four channels are active; with one or two
  // mics the standard 2-channel I2S frame is used.
  const uint8_t active =
      (this->mic_1_ ? 1 : 0) + (this->mic_2_ ? 1 : 0) + (this->mic_3_ ? 1 : 0) + (this->mic_4_ ? 1 : 0);
  ok &= this->write_reg_(ES7210_SDP_INTERFACE2_REG12, active >= 4 ? 0x02 : 0x00);

  return ok;
}

void ES7210::setup() {
  ESP_LOGCONFIG(TAG, "Setting up ES7210...");

  bool ok = true;

  // Reset sequence.
  ok &= this->write_reg_(ES7210_RESET_REG00, 0xFF);
  ok &= this->write_reg_(ES7210_RESET_REG00, 0x41);
  ok &= this->write_reg_(ES7210_CLOCK_OFF_REG01, 0x3F);

  if (!ok) {
    ESP_LOGE(TAG, "ES7210 not responding - check wiring/address");
    this->mark_failed();
    return;
  }

  // Chip state / power-up cycle timing.
  ok &= this->write_reg_(ES7210_TIME_CONTROL0_REG09, 0x30);
  ok &= this->write_reg_(ES7210_TIME_CONTROL1_REG0A, 0x30);

  // High-pass filter defaults.
  ok &= this->write_reg_(ES7210_ADC12_HPF2_REG23, 0x2A);
  ok &= this->write_reg_(ES7210_ADC12_HPF1_REG22, 0x0A);
  ok &= this->write_reg_(ES7210_ADC34_HPF2_REG20, 0x0A);
  ok &= this->write_reg_(ES7210_ADC34_HPF1_REG21, 0x2A);

  // Slave mode: the ESP32 drives BCLK/LRCK. This matches the Waveshare BSP,
  // which sets I2S_ROLE_MASTER on the ESP32 side.
  ok &= this->update_reg_bits_(ES7210_MODE_CONFIG_REG08, 0x01, 0x00);

  // Analog power, mic bias 2.87 V.
  ok &= this->write_reg_(ES7210_ANALOG_REG40, 0x43);
  ok &= this->write_reg_(ES7210_MIC12_BIAS_REG41, 0x70);
  ok &= this->write_reg_(ES7210_MIC34_BIAS_REG42, 0x70);

  ok &= this->write_reg_(ES7210_OSR_REG07, 0x20);
  ok &= this->write_reg_(ES7210_MAINCLK_REG02, 0xC1);

  // Sample word length. In slave mode the frame clock comes from the ESP32,
  // so only the word length needs setting here.
  uint8_t iface;
  if (this->read_reg_(ES7210_SDP_INTERFACE1_REG11, &iface)) {
    iface &= 0x1F;
    switch (this->bits_per_sample_) {
      case 24:
        iface |= 0x00;
        break;
      case 32:
        iface |= 0x80;
        break;
      case 16:
      default:
        iface |= 0x60;
        break;
    }
    ok &= this->write_reg_(ES7210_SDP_INTERFACE1_REG11, iface);
  } else {
    ok = false;
  }

  ok &= this->configure_mic_channels_();
  ok &= this->apply_gain_();

  // Bring the ADC out of power-down and release the clock gate.
  ok &= this->write_reg_(ES7210_POWER_DOWN_REG06, 0x00);
  ok &= this->write_reg_(ES7210_CLOCK_OFF_REG01, 0x14);

  if (!ok) {
    ESP_LOGE(TAG, "ES7210 initialisation failed");
    this->mark_failed();
    return;
  }

  this->setup_ok_ = true;
  ESP_LOGCONFIG(TAG, "ES7210 initialised");
}

bool ES7210::set_mic_gain(float mic_gain) {
  this->mic_gain_ = mic_gain;
  if (!this->setup_ok_) {
    return false;
  }
  return this->apply_gain_();
}

void ES7210::dump_config() {
  ESP_LOGCONFIG(TAG, "ES7210 Audio ADC:");
  LOG_I2C_DEVICE(this);
  if (this->is_failed()) {
    ESP_LOGE(TAG, "  Setup FAILED");
    return;
  }
  ESP_LOGCONFIG(TAG, "  Mode: SLAVE (ESP32 drives BCLK/LRCK)");
  ESP_LOGCONFIG(TAG, "  Bits per sample: %u", this->bits_per_sample_);
  ESP_LOGCONFIG(TAG, "  Mic gain: %.1f dB (reg 0x%02X)", this->mic_gain_,
                ES7210::gain_to_reg_(this->mic_gain_));
  ESP_LOGCONFIG(TAG, "  Channels: MIC1=%s MIC2=%s MIC3=%s MIC4=%s", YESNO(this->mic_1_),
                YESNO(this->mic_2_), YESNO(this->mic_3_), YESNO(this->mic_4_));
}

}  // namespace es7210
}  // namespace esphome
