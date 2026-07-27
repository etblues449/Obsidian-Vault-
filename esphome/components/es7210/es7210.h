#pragma once

#include "esphome/components/audio_adc/audio_adc.h"
#include "esphome/components/i2c/i2c.h"
#include "esphome/core/component.h"

namespace esphome {
namespace es7210 {

// Register map - from Espressif esp_codec_dev device/es7210/es7210_reg.h
static const uint8_t ES7210_RESET_REG00 = 0x00;
static const uint8_t ES7210_CLOCK_OFF_REG01 = 0x01;
static const uint8_t ES7210_MAINCLK_REG02 = 0x02;
static const uint8_t ES7210_MASTER_CLK_REG03 = 0x03;
static const uint8_t ES7210_LRCK_DIVH_REG04 = 0x04;
static const uint8_t ES7210_LRCK_DIVL_REG05 = 0x05;
static const uint8_t ES7210_POWER_DOWN_REG06 = 0x06;
static const uint8_t ES7210_OSR_REG07 = 0x07;
static const uint8_t ES7210_MODE_CONFIG_REG08 = 0x08;
static const uint8_t ES7210_TIME_CONTROL0_REG09 = 0x09;
static const uint8_t ES7210_TIME_CONTROL1_REG0A = 0x0A;
static const uint8_t ES7210_SDP_INTERFACE1_REG11 = 0x11;
static const uint8_t ES7210_SDP_INTERFACE2_REG12 = 0x12;
static const uint8_t ES7210_ADC34_HPF2_REG20 = 0x20;
static const uint8_t ES7210_ADC34_HPF1_REG21 = 0x21;
static const uint8_t ES7210_ADC12_HPF1_REG22 = 0x22;
static const uint8_t ES7210_ADC12_HPF2_REG23 = 0x23;
static const uint8_t ES7210_ANALOG_REG40 = 0x40;
static const uint8_t ES7210_MIC12_BIAS_REG41 = 0x41;
static const uint8_t ES7210_MIC34_BIAS_REG42 = 0x42;
static const uint8_t ES7210_MIC1_GAIN_REG43 = 0x43;
static const uint8_t ES7210_MIC2_GAIN_REG44 = 0x44;
static const uint8_t ES7210_MIC3_GAIN_REG45 = 0x45;
static const uint8_t ES7210_MIC4_GAIN_REG46 = 0x46;
static const uint8_t ES7210_MIC12_POWER_REG4B = 0x4B;
static const uint8_t ES7210_MIC34_POWER_REG4C = 0x4C;

class ES7210 : public audio_adc::AudioAdc, public Component, public i2c::I2CDevice {
 public:
  void setup() override;
  void dump_config() override;
  float get_setup_priority() const override { return setup_priority::DATA; }

  bool set_mic_gain(float mic_gain) override;
  float mic_gain() override { return this->mic_gain_; }

  void set_bits_per_sample(uint8_t bits) { this->bits_per_sample_ = bits; }
  void set_mic_select(bool m1, bool m2, bool m3, bool m4) {
    this->mic_1_ = m1;
    this->mic_2_ = m2;
    this->mic_3_ = m3;
    this->mic_4_ = m4;
  }

 protected:
  bool write_reg_(uint8_t reg, uint8_t value);
  bool read_reg_(uint8_t reg, uint8_t *value);
  bool update_reg_bits_(uint8_t reg, uint8_t mask, uint8_t value);

  bool configure_mic_channels_();
  bool apply_gain_();
  static uint8_t gain_to_reg_(float db);

  float mic_gain_{30.0f};
  uint8_t bits_per_sample_{16};
  bool mic_1_{true};
  bool mic_2_{true};
  bool mic_3_{false};
  bool mic_4_{false};
  bool setup_ok_{false};
};

}  // namespace es7210
}  // namespace esphome
