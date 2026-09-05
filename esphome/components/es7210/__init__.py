"""ES7210 4-channel audio ADC (microphone front-end).

Ported from Espressif's esp_codec_dev ES7210 driver (device/es7210/es7210.c,
v1.6.2) for use as an ESPHome external component.

Used on boards such as the Waveshare ESP32-S3-CAM-OV3660 (SKU 33700), where the
onboard microphones are wired through an ES7210 at I2C 0x40. Without this
component the ES7210 is never powered up or clocked, so the I2S DIN line stays
silent regardless of microphone configuration.
"""

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import i2c

CODEOWNERS = ["@etblues449"]
DEPENDENCIES = ["i2c"]

es7210_ns = cg.esphome_ns.namespace("es7210")
ES7210 = es7210_ns.class_("ES7210", cg.Component, i2c.I2CDevice)

CONFIG_SCHEMA = cv.Schema({})
