---
name: Samsung TV Home Assistant setup guide
description: Imported Claude.ai conversation from 2026-04-07 (2 messages)
type: reference
uuid: 3ac3adea-9b1a-4830-a3ca-89c02045e816
created_at: 2026-04-07T17:33:54.908875Z
updated_at: 2026-04-26T21:34:06.180853Z
---

# Samsung TV Home Assistant setup guide

## human — 2026-04-07 17:33:56
_files:_ 107777.jpg

How do I set up my Samsung TV properly with these configs 

Skip to content
ollo69
ha-samsungtv-smart
Repository navigation
Code
Issues
52
 (52)
Pull requests
4
 (4)
Important update
On April 24 we'll start using GitHub Copilot interaction data for AI model training unless you opt out. Review this update and manage your preferences in your GitHub account settings.
📺 Home Assistant SamsungTV Smart integration with SmartThings API Support.

License
 Apache-2.0 license
 634 stars
 200 forks
 24 watching
 4 Branches
 159 Tags
 Activity
Public repository · Forked from jaruba/ha-samsungtv-tizen
ollo69/ha-samsungtv-smart
This branch is 375 commits ahead of and 87 commits behind jaruba/ha-samsungtv-tizen:master.
Name	
ollo69
ollo69
8 months ago
.devcontainer
2 years ago
.github
8 months ago
.vscode
2 years ago
config
3 years ago
custom_components
8 months ago
docs
8 months ago
script
4 years ago
scripts
3 years ago
tests
2 years ago
.dockerignore
4 years ago
Repository files navigation
README
Apache-2.0 license
 hacs_badge   

HomeAssistant - SamsungTV Smart Component
This is a custom component to allow control of SamsungTV devices in HomeAssistant. Is a modified version of the built-in samsungtv with some extra features.
This plugin is only for 2016+ TVs model! (maybe all tizen family)

This project is a fork of the component SamsungTV Tizen. I added some feature like the possibility to configure it using the HA user interface, simplifing the configuration process. I also added some code optimizition in the comunication layer using async aiohttp instead of request. Part of the code and documentation available here come from the original project.

Additional Features:
Ability to send keys using a native Home Assistant service
Ability to send chained key commands using a native Home Assistant service
Supports Assistant commands (Google Home, should work with Alexa too, but untested)
Extended volume control
Ability to customize source list at media player dropdown list
Cast video URLs to Samsung TV
Connect to SmartThings Cloud API for additional features: see TV channel names, see which HDMI source is selected, more key codes to change input source
Display logos of TV channels (requires Smartthings enabled) and apps
N|Solid N|Solid

Installation
1. Easy Mode
Install via HACS.

2. Manual
Install it as you would do with any homeassistant custom component:

Download custom_components folder.
Copy the samsungtv_smart directory within the custom_components directory of your homeassistant installation. The custom_components directory resides within your homeassistant configuration directory. Note: if the custom_components directory does not exist, you need to create it. After a correct installation, your configuration directory should look like the following.
└── ...
└── configuration.yaml
└── custom_components
    └── samsungtv_smart
        └── __init__.py
        └── media_player.py
        └── websockets.py
        └── shortcuts.py
        └── smartthings.py
        └── upnp.py
        └── exceptions.py
        └── ...
Configuration
Once the component has been installed, you need to configure it in order to make it work. There are two ways of doing so:

Using the web interface (Lovelace) [recommended]
Manually editing the configuration.yaml file
Important: To complete the configuration procedure properly, you must be sure that your TV is turned on and connected to the LAN (wired or wireless). Stay near to your TV during configuration because probably you will need to accept the access request that will prompt on your TV screen.

Note: To configure the component for using SmartThings (strongly suggested) you need to generate an access token as explained in this guide. Also make sure your TV is logged into your SmartThings account and registered in SmartThings phone app before starting configuration.

Option A: Configuration using the web UI [recommended]
From the Home Assistant front-end, navigate to 'Configuration' then 'Integrations'. Click + button in botton right corner, search 'SamsungTV Smart' and click 'Configure'.
In the configuration mask, enter the IP address of the TV, the name for the Entity and the SmartThings personal access token (if created) and then click 'Submit'
Important: look for your TV screen and confirm immediately with OK if a popup appear.
Congrats! You're all set!
Note: be sure that your TV and HA are connected to the same VLAN. Websocket connection through different VLAN normally not work because not supported by Samsung TV. If you have errors during configuration, try to power cycle your TV. This will close running applications that can prevent websocket connection initialization.

Option B: Configuration via editing configuration.yaml
From v0.3.16 initial configuration from yaml is not allowed.
You can still use configuration.yaml to set the additional parameter as explained below.

Configuration options
From the Home Assistant front-end, navigate to 'Configuration' then 'Integrations'. Identify the 'SamsungTV Smart' integration configured for your TV and click the OPTIONS button.
Here you can change the following options:

Use SmartThings TV Status information
(default = True)
This option is available only if SmartThings is configured. When enabled the component will try to retrieve from SmartThings the information about the TV Status. This information is always used in conjunction with local ping result.

Use SmartThings TV Channels information
(default = True)
This option is available only if SmartThings is configured. When enabled the component will try to retrieve from SmartThings the information about the TV Channel and TV Channel Name or the Running App
Note: in some case this information is not properly updated, disabled it you have incorrect information.

Use SmartThings TV Channels number information
(default = False)
This option is available only if SmartThings is configured. When enabled then the TV Channel Names will show as media titles, by setting this to True the TV Channel Number will also be attached to the end of the media title (when applicable).
Note: not always SmartThings provide the information for channel_name and channel_number.

Logo options
The background color and channel / service logo preference to use, example: "white-color" (background: white, logo: color).
Supported values: "none", "white-color", "dark-white", "blue-color", "blue-white", "darkblue-white", "transparent-color", "transparent-white"
Default value: "white-color" (background: white, logo: color)
Notice that your logo is missing or outdated? In case of a missing TV channel logo also make sure you have Smartthings enabled. This is required for the component to know the name of the TV channel.
Check guide here for updating the logo database this component is relying on.

Allow use of local logo images
(default = True)
When enabled the integration will try to get logo image for the current media from the www/samsungtv_smart_logos sub folder of home-assistant configuration folder. You can add new logo images in this folder, using the following rules for logo filename:

must be equal to the name of the media_title attribute, removing space, _ and . characters and replacing + character with the string plus
must have the .png suffix
must be in png format (suggested size is 400x400 pixels)
Applications list load mode at startup
Possible values: All Apps, Default Apps and Not Load
This option determine the mode application list is automatic generated.
With All Apps the list will contain all apps installed on the TV, with Default Apps will be generated a minimal list with only the most common application, with Not Load application list will be empty.
Note: If a custom Application List in config options is defined this option is not available.

Method used to turn on TV
Possible values: WOL Packet and SmartThings
This option is available only if SmartThings is configured. WOL Packet is better when TV use wired connection.
SmartThings normally work only when TV use wireless connection.

Show advanced options
Selecting this option and clicking submit a new options menu is opened containing the list of other options described below.

Advanced options
Applications launch method used
Possible values: Control Web Socket Channel, Remote Web Socket Channel and Rest API Call
This option determine the mode used to launch applications.
Use Rest API Call only if the other 2 methods do not work.

Number of times WOL packet is sent to turn on TV
(default = 1, range from 1 to 5)
This option allow to configure the number of time the WOL packet is sent to turn on TV. Increase the value until the TV properly turn-on.

TCP port used to check power status
(default = 0, range from 0 to 65535)
With this option is possible to check the availability of a specific port to determinate power status instead of using ICMP echo. To continue use ICMP echo, leave the value to 0, otherwise set a port that is known becoming available when TV is on (possible working ports, depending on TV models, are 9110, 9119, 9197).
N.B. If you set an invalid port here, TV is always reported as off.

Binary sensor to help detect power status
An external binary_sensor selectable from a list that can be used to determinate TV power status.
This can be any available binary_sensor that can better determinate the status of the TV, for example a binary_sensor based on TV power consumption. It is suggested to not use a sensor based on ping platform because this method is already implemented by the integration.

Use volume mute status to detect fake power ON
(default = True)
When enabled try to detect fake power on based on the Volume mute state, based on the assumption that when the TV is powered on the volume is always unmuted.

Dump apps list on log file at startup
(default = False)
When enabled the component will try to dump the list of available apps on TV in the HA log file at Info level. The dump of the apps may not work for some TV models.

Power button switch to art mode
(default = False)
When enabled the power button in UI will be used to toggle from On to Art Mode (and vice versa) and will not power off the TV (you can still use the turn off service to power off the TV).
Note: This option is valid only for TV that support Art Mode ("The Frame" models).

Synched entities configuration
List of entity to Power OFF with TV
A list of HA entity to Turn OFF when the TV entity is turned OFF (maximum 4). Select entities from list. This call the service homeassistant.turn_off for maximum the first 4 entity in the provided list.

List of entity to Power ON with TV
A list of HA entity to Turn ON when the TV entity is turned ON (maximum 4). Select entities from list. This call the service homeassistant.turn_on for maximum the first 4 entity in the provided list.

Sources list configuration
This contains the KEYS visible sources in the dropdown list in media player UI.
You can configure the pair list Name: Key using the yaml editor in the option page. If a source list is present in configuration.yaml, it will be imported in the options the first time that the integration is loaded.

Default value:

    1| TV: KEY_TV
    2| HDMI: KEY_HDMI
If SmartThings is configured and the source_list not, the component will try to identify and configure automatically the sources configured on the TV with the relative associated names (new feature, tested on QLed TV). The created list is available in the HA log file.
You can also chain KEYS, example:

    1| TV: KEY_SOURCES+KEY_ENTER
And even add delays (in milliseconds) between sending KEYS, example:

    1| TV: KEY_SOURCES+500+KEY_ENTER
Resources: key codes / key patterns
Warning: changing input source with voice commands only works if you set the device name in source_list as one of the whitelisted words that can be seen on this page (under "Mode Settings")

Application list configuration
This contains the APPS visible sources in the dropdown list in media player UI.
You can configure the pair list Name: Key using the yaml editor in the option page. If an application list is present in configuration.yaml, it will be imported in the options the first time that the integration is loaded.

If the Application list is not manually configured, during startup the integration will try to automatically generate a list of available application and a log message is generated with the content of the list. This list can be used to create a manual list following app_list guide. Automatic list generation not work with some TV models.

Example value:

    1| Netflix: "11101200001"
    2| YouTube: "111299001912"
    3| Spotify: "3201606009684"
Known lists of App IDs: List 1, List 2

Channel list configuration
This contains the tv CHANNELS visible sources in the dropdown list in media player UI. To guarantee performance keep the list small, recommended maximum 30 channels.
You can configure the pair list Name: Key using the yaml editor in the option page. If a channel list is present in configuration.yaml, it will be imported in the options the first time that the integration is loaded.

Example value:

    1| MTV: "14"
    2| Eurosport: "20"
    3| TLC: "21"
You can also specify the source that must be used for every channel. The source must be one of the source name defined in the source_list
Example value:

    1| MTV: 14@TV
    2| Eurosport: 20@TV
    3| TLC: 21@HDMI
Custom configuration parameters
You can configure additional option for the component using configuration variable in configuration.yaml section.

Section in configuration.yaml file can also not be present and is not required for component to work. If you want to configure any parameters, you must create one section that start with - host as shown in the example below:

samsungtv_smart:
  - host: <YOUR TV IP ADDRES>
    ...
Then you can add any of the following parameters:

mac:
(string)(Optional)
This is an optional value, normally is automatically detected during setup phase and so is not required to specify it. You should try to configure this parameter only if the setup fail in the detection.
The mac-address is used to turn on the TV. If you set it manually, you must find the right value from the TV Menu or from your network router.

broadcast_address:
(string)(Optional)
Do not set this option if you do not know what it does, it can break turning your TV on.
The ip address of the host to send the magic packet (for wakeonlan) to if the "mac" property is also set.
Default value: "255.255.255.255"
Example value: "192.168.1.255"

Deprecated configuration parameters
Deprecated parameters were used by old integration version. Are still valid but normally are automatically imported in application options and not used anymore, so after first import can be removed from configuration.yaml.

source_list:
(json)(Optional)
This contains the KEYS visible sources in the dropdown list in media player UI.
Default value: '{"TV": "KEY_TV", "HDMI": "KEY_HDMI"}'
If SmartThings is configured and the source_list not, the component will try to identify and configure automatically the sources configured on the TV with the relative associated names (new feature, tested on QLed TV). The created list is available in the HA log file.
You can also chain KEYS, example: '{"TV": "KEY_SOURCES+KEY_ENTER"}'
And even add delays (in milliseconds) between sending KEYS, example:
'{"TV": "KEY_SOURCES+500+KEY_ENTER"}'
Resources: key codes / key patterns
Warning: changing input source with voice commands only works if you set the device name in source_list as one of the whitelisted words that can be seen on this page (under "Mode Settings")

app_list:
(json)(Optional)
This contains the APPS visible sources in the dropdown list in media player UI.
Default value: AUTOGENERATED
If the app_list is not manually configured, during startup is generated a file in the custom component folder with the list of all available applications. This list can be used to create a manual list following app_list guide
Example value: '{"Netflix": "11101200001", "YouTube": "111299001912", "Spotify": "3201606009684"}'
Known lists of App IDs: List 1, List 2

channel_list:
(json)(Optional)
This contains the tv CHANNELS visible sources in the dropdown list in media player UI. To guarantee performance keep the list small, recommended maximum 30 channels.
Example value: '{"MTV": "14", "Eurosport": "20", "TLC": "21"}'
You can also specify the source that must be used for every channel. The source must be one of the defined in the source_list
Example value: '{"MTV": "14@TV", "Eurosport": "20@TV", "TLC": "21@HDMI"}'

Removed configuration parameters
Removed parameters were used by old integration version, are not used and supported anymore and replaced by application option. For this reason should be removed from configuration.yaml.

api_key:
(string)(Optional) (obsolete/not used from v0.3.16 - configuration from yaml is not allowed)
API Key for the SmartThings Cloud API, this is optional but adds better state handling on, off, channel name, hdmi source, and a few new keys: ST_TV, ST_HDMI1, ST_HDMI2, ST_HDMI3, etc. (see more at SmartThings Keys)
Read How to get an API Key for SmartThings
This parameter can also be provided during the component configuration using the user interface.
Note: this parameter is used only during initial configuration and then stored in the registry. It's not possible to change the value after that the component is configured. To change the value you must delete the integration from UI.

device_id:
(string)(Optional) (obsolete/not used from v0.3.16 - configuration from yaml is not allowed)
Device ID for the SmartThings Cloud API. This is optional, to be used only if component fails to automatically determinate it. Read SmartThings Device ID to understand how identify the correct value to use.
This parameter will be requested during component configuration from user interface when required.
Note: this parameter is used only during initial configuration and then stored in the registry. It's not possible to change the value after that the component is configured. To change the value you must delete the integration from UI.

device_name: (obsolete/not used from v0.3.16 - configuration from yaml is not allowed)
(string)(Optional)
This is an optional value, used only to identify the TV in SmartThings during initial configuration if you have more TV registered. You should configure this parameter only if the setup fails in the detection.
The device_name to use can be read using the SmartThings app
Note: this parameter is used only during initial configuration.

show_channel_number: (obsolete/not used from v0.3.16 and replaced by Configuration options)
(boolean)(Optional)
If the SmartThings API is enabled (by settings "api_key" and "device_id"), then the TV Channel Names will show as media titles, by setting this to True the TV Channel Number will also be attached to the end of the media title (when applicable).
Note: not always SmartThings provide the information for channel_name and channel_number.

load_all_apps: (obsolete/not used from v0.3.4 and replaced by Configuration options)
(boolean)(Optional)
This option is True by default.
Setting this parameter to false, if a custom app_list is not defined, the automatic app_list will be generated limited to few application (the most common).

update_method: (obsolete/not used from v0.3.3)
(string)(Optional)
This change the ping method used for state update. Values: "ping", "websockets" and "smartthings"
Default value: "ping" if SmartThings is not enabled, else "smartthings"
Example update_method: "websockets"

update_custom_ping_url: (obsolete/not used from v0.2.x)
(string)(Optional)
Use custom endpoint to ping.
Default value: PING TO 8001 ENDPOINT
Example update_custom_ping_url: "http://192.168.1.77:9197/dmr"

scan_app_http: (obsolete/not used from v0.2.x)
(boolean)(Optional)
This option is True by default. In some cases (if numerical IDs are used when setting app_list) HTTP polling will be used (1 request per app) to get the running app.
This is

## assistant — 2026-04-07 17:34:07

 Here's what each config section does and the recommended setup order:

**1. Standard options → first**
Set your SmartThings API token here if you have one. It unlocks channel names, proper on/off detection, and HDMI source names. Well worth doing.

**2. Sources list configuration**
Controls what appears in the input dropdown. Default is just TV and HDMI. Edit in YAML format like:
```yaml
TV: KEY_TV
HDMI 1: KEY_HDMI
HDMI 2: KEY_HDMI2
```

**3. Applications list configuration**
Apps shown in the dropdown. Leave it on auto-generate first — it'll log the available app IDs on startup. Then you can build a manual list from those.

**4. Channels list configuration**
Optional. Only add this if you want quick channel switching. Keep it under 30 entries for performance.

**5. Synched entities configuration**
Lets you turn other HA devices on/off with the TV — useful if your soundbar or projector aren't auto-linked.

**6. Advanced options → last**
Only needed if things aren't working. Common fixes here:
- Change **app launch method** if apps won't open
- Increase **WOL packet count** if TV won't wake
- Set a **TCP port** (try 9110) if power state detection is unreliable

**Recommended first-time flow:**
1. Standard options (add SmartThings token)
2. Save and restart
3. Check HA logs for the auto-generated app/source lists
4. Come back and paste those into Applications/Sources lists
5. Save options and exit

Do you have a SmartThings token set up already?
