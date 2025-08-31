import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Info,
  Heart,
  Github,
  Mail,
  Coffee,
  Star,
  Zap,
  Shield,
  Cpu,
  Palette
} from 'lucide-react';
// @ts-ignore
import appIcon from '../../../../resources/appicon.png';
import { Analytics } from '../lib/analytics';
import { useState, useEffect } from 'react';

export default function About() {
  const [appVersion, setAppVersion] = useState('1.0.0')
  
  const features = [
    { icon: Zap, title: 'Fast OCR', description: 'Instant text recognition' },
    { icon: Shield, title: 'Privacy First', description: 'All processing done locally' },
    { icon: Cpu, title: 'Lightweight', description: 'Minimal system resources' },
    { icon: Palette, title: 'Clean UI', description: 'Beautiful, intuitive interface' }
  ];

  useEffect(() => {
    // Fetch app version from main process
    const fetchAppVersion = async () => {
      try {
        const versionResult = await window.api?.getAppVersion()
        if (versionResult?.success && versionResult.version) {
          setAppVersion(versionResult.version)
        }
      } catch (error) {
        console.warn('Failed to fetch app version:', error)
      }
    }
    
    fetchAppVersion()
  }, [])

  const handleOpenUrl = async (url: string) => {
    await Analytics.urlOpened()
    window.api.openExternalUrl(url)
  };

  return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <img className="w-24 h-24" src={appIcon} alt=""/>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-900">SayaLens</h1>
              <p className="text-slate-600 mt-2 text-lg">Advanced OCR and text extraction tool</p>
              <Badge variant="secondary" className="mt-2 bg-blue-100 text-blue-800">
                Version {appVersion}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* App Features */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Star className="w-6 h-6 mr-2 text-blue-600" />
                  Features
                </CardTitle>
                <CardDescription>
                  Powerful text extraction capabilities built for professionals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-rows-1 md:grid-rows-2 gap-6">
                  {features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <feature.icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                          <p className="text-sm text-slate-600 mt-1">{feature.description}</p>
                        </div>
                      </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div>

              {/* Support & Donations */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                    <Heart className="w-6 h-6 mr-2 text-red-500" />
                    Support Development
                  </CardTitle>
                  <CardDescription>
                    Help keep this app free and continuously improving
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <Button
                        variant="outline"
                        className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
                        size="lg"
                        onClick={() => handleOpenUrl('https://buymeacoffee.com/nafplann')}
                    >
                      <Coffee className="w-5 h-5 mr-2" />
                      Buy Me a Coffee
                    </Button>
                    <Button
                        className="w-full bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                        size="lg"
                        onClick={() => handleOpenUrl('https://github.com/sponsors/nafplann')}
                    >
                      <Heart className="w-5 h-5 mr-2" />
                      Sponsor on GitHub
                    </Button>
                  </div>

                  <Separator />

                  <div className="text-center space-y-2">
                    <p className="text-sm text-slate-600">
                      Your support helps maintain and improve SayaLens
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Developer Info */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                    <Info className="w-6 h-6 mr-2 text-blue-600" />
                    Developer
                  </CardTitle>
                  <CardDescription>
                    Get in touch for support or feedback
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <Github className="w-5 h-5 text-slate-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">GitHub</p>
                        <p className="text-sm text-slate-600">@nafplann</p>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs"
                        onClick={() => handleOpenUrl('https://github.com/nafplann')}
                      >
                        Visit
                      </Button>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <Mail className="w-5 h-5 text-slate-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">Email</p>
                        <p className="text-sm text-slate-600">nafplann@gmail.com</p>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs"
                        onClick={() => handleOpenUrl('mailto:nafplann@gmail.com')}>
                        Email
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center py-6 text-slate-500">
            <p className="text-sm">
              © {(new Date()).getFullYear()} SayaLens. Made with ❤️ from Makassar, Indonesia.
            </p>
          </div>
        </div>
      </div>
  );
}