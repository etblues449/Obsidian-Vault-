import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import audio_adc, i2c
from esphome.const import CONF_ID, CONF_MIC_GAIN

from . import ES7210, es7210_ns

AUTO_LOAD = ["audio_adc"]
DEPENDENCIES = ["i2c"]

CONF_MIC_1 = "mic_1"
CONF_MIC_2 = "mic_2"
CONF_MIC_3 = "mic_3"
CONF_MIC_4 = "mic_4"
CONF_BITS_PER_SAMPLE = "bits_per_sample"

ES7210_BITS = [16, 24, 32]

CONFIG_SCHEMA = (
    cv.Schema(
        {
            cv.GenerateID(): cv.declare_id(ES7210),
            # Board default is 30 dB, matching Espressif's reference open().
            cv.Optional(CONF_MIC_GAIN, default="30dB"): cv.All(
                cv.decibel, cv.float_range(min=0.0, max=37.5)
            ),
            # The CAM-OV3660 has two physical mics on channels 1 and 2.
            cv.Optional(CONF_MIC_1, default=True): cv.boolean,
            cv.Optional(CONF_MIC_2, default=True): cv.boolean,
            cv.Optional(CONF_MIC_3, default=False): cv.boolean,
            cv.Optional(CONF_MIC_4, default=False): cv.boolean,
            cv.Optional(CONF_BITS_PER_SAMPLE, default=16): cv.one_of(
                *ES7210_BITS, int=True
            ),
        }
    )
    .extend(cv.COMPONENT_SCHEMA)
    .extend(i2c.i2c_device_schema(0x40))
)


def _validate(config):
    if not any(
        config[key] for key in (CONF_MIC_1, CONF_MIC_2, CONF_MIC_3, CONF_MIC_4)
    ):
        raise cv.Invalid("At least one microphone channel must be enabled")
    return config


FINAL_VALIDATE_SCHEMA = _validate


async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
    await i2c.register_i2c_device(var, config)

    cg.add(var.set_mic_gain(config[CONF_MIC_GAIN]))
    cg.add(var.set_bits_per_sample(config[CONF_BITS_PER_SAMPLE]))
    cg.add(
        var.set_mic_select(
            config[CONF_MIC_1],
            config[CONF_MIC_2],
            config[CONF_MIC_3],
            config[CONF_MIC_4],
        )
    )
