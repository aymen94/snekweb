{
  "targets": [
    {
      "target_name": "snekweb_native",
      "sources": [
        "src/addon.cc"
      ],
      "cflags_cc": [
        "-std=c++17"
      ],
      "conditions": [
        [
          "OS=='win'",
          {
            "msvs_settings": {
              "VCCLCompilerTool": {
                "AdditionalOptions": [
                  "/std:c++17"
                ]
              }
            }
          }
        ]
      ]
    }
  ]
}